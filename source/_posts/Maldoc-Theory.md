---
layout: post
title: "Carrier files theory"
date: 2021-01-31
excerpt: A carrier file (a.k.a. "**MalDoc**") is a document that carries with it a malicious payload...
categories:
  - Malware Analysis
toc: true
---
# Maldoc

A carrier file (a.k.a. "**MalDoc**") is a document that carries with it a malicious payload.
The most common carrier files are **Office documents** along with **Portable Document Format**
(PDF) files.
These files are also named **MalDocs** in security community.

# Transfer techniques

These types of files are often attached or linked within email
nowadays there are a lot of detection techinques and email attachments are the #1 malware entry vector for businesses because users often transfer documents via email and they are prone to open attachments for example:
- Purchase Orders
- Resumes
- Receipts
- Contract Proposals

# Downloader vs Dropper
## Downloader
- Reaches out to external resource via Internet
- Downloads malware -> executes on host
- When opening, requires Internet access to pwn 

## Dropper
- Malware contained within document
- Drops malware onto host -> executes on host
- Droppers don't require initial Internet access

Quite simply, a downloader is a malicious threat that downloads additional threats (known as stages) form the Internet. Meanwhile, a dropper is a malicious threat that contains the next stage within it and is able to drop
the program on to the host and execute it.

Downloaders are usually smaller, as they often contain simple (though  obfuscated) scripts that download additional stages.

Droppers are usually larger in size, as they must embed the next stage of the threat within themselves.


# Office file structures
1. Office 97-2003
	- **O**bjetc **l**inking and **e**mbedding **c**ompound **f**ile a.k.a. "OLE CF" - it's a file system
	- MS Office XML (.xml)
2. Office 2007+
	- Office Open XML (OOXML/MOX; .docx/.docm)
	- it's just a ZIP file with an XML structure
3. Rich Text Format (RTF)
	- Can embed raw OLE documents 

# VBA Macros
In previous Office versions, by default only signed or trusted macros can be launched by the user, because “high security”mode is on by default in Office 2007, there are no more medium or high security levels. 
The new default level is called “Disable all macros with notification” and there are also new other levels, available in the new Trust Center which is a central place to set all security parameters.
This is an example file structure of a .docm file:
- word/document.xml: document body
- word/styles.xml: style data
- word/settings.xml: settings for the document
- docProps/app.xmlandcore.xml: metadata (author, title, ...)

There may also be optional binary files:
- Pictures and other media: JPEG, PNG, GIF, TIFF, WMF, ...
- OLE objects, VBA macros, printer settings, ...

**Macros storage** :  
VBA macros are stored in a file named **vbaProject.bin**, which path in the archive depends on the application:
- Word: word/vbaProject.bin
- Excel: xl/vbaProject.bin
- PowerPoint: ppt/vbaProject.bin

This is a binary file using Microsoft OLE2 format (structuredstorage), and this is not described in the current Open XMLspecifications.

# Maldoc sample
You can take this sample via any.run :
`md5 : b92021ca10aed3046fc3be5ac1c2a094`

This file is a .docm because if you open it with an hex editor you can see the magic number `0x50 0x4B` PK (stands for **P**hil **K**ats the creator of the zip file format), so probably it would contains macros.

[![1](/images/Malware_Analysis/Maldoc/foto1.png)](/images/Malware_Analysis/Maldoc/foto1.png)

If you analyze it with oledump.py you can see that streams A17 and A18 contain macros, notice that the streams \_\_SRP\_\* means that the macros are cached and the macros were run before we took the sample. 

[![2](/images/Malware_Analysis/Maldoc/foto2.png)](/images/Malware_Analysis/Maldoc/foto2.png)

If we open the VBA editor in office with with CTRL-F11 we can notice that stream pGv5GCKO wants to create a process, and if we debug it, we can retrieve the powershell script that it runs.

[![5](/images/Malware_Analysis/Maldoc/foto5.png)](/images/Malware_Analysis/Maldoc/foto5.png)

With a fast behaviour analysis we can see the powershell script with event viewer

[![4](/images/Malware_Analysis/Maldoc/foto4.png)](/images/Malware_Analysis/Maldoc/foto4.png)

and we notice that the malware tried to connect to
`http://blockchainjoblist.com/wp-admin/014080`

[![3](/images/Malware_Analysis/Maldoc/foto3.png)](/images/Malware_Analysis/Maldoc/foto3.png)

below the decoded powershell script

<script src="https://gist.github.com/CaptWake/450699463490d97499765b7fbc4ba0f7.js"></script>

we can notice that it tries to download an exe from the urls provided in the `$pLjBqINE` variable and and save it under `%USER%` env variable under the name `284.exe` and runs it.
