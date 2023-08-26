---
layout: post
title: "Analysing Heodo Dropper, a new version of Emotet"
date: 2020-09-26
excerpt: Nowadays Emotet is a Trojan that is primarily spread through spam emails (malspam)...
categories:
  - Malware Analysis
toc: true
---
# <u> What is Emotet? </u>

Nowadays Emotet is a Trojan that is primarily spread through spam emails (malspam). The infection may arrive either via malicious script, macro-enabled document files, or malicious link. Emotet emails may contain familiar branding designed to look like a legitimate email.
We can describe it as infrastructure as a service for content delivery. 
For example Emotet communicates with a c2 server to download additional malware like ransomware, ecc...
Over the years Emotet was classified based on c2 server, payload and delivery solution.
In this scenario the malware was sent via email. 

# Static Analysis of the file

`MD5 : 29b48523e390bf2393796049d7042461`

First of all we nedd to identify what type of file this is, this can be done with a tool named DIE (Detect It Easy)

[![1](/images/Malware_Analysis/Heodo-Dropper/1.png)](/images/Malware_Analysis/Heodo-Dropper/1.png)

We can see above that this is a Microsoft Office Document (probably with macro insides), to analyse it we use a tool called oledump.py and we can look at the output
```
oldeump.py emotet.bin
```

[![2](/images/Malware_Analysis/Heodo-Dropper/2.png)](/images/Malware_Analysis/Heodo-Dropper/2.png)

In this case oledump recognized 2 files that are marked with M (M means that's a macro), we can redirect the output in a file and then open it with a text editor,
in my vm I have installed sublime text
```
oledump.py -s 17 -v emotet.bin > s17
oledump.py -s -v emotet.bin > s18
```
Open the s17 file created and we can see that there is a function called after DocumentOpen() named `Tbcepkcgnhpwx` 

[![3](/images/Malware_Analysis/Heodo-Dropper/3.png)](/images/Malware_Analysis/Heodo-Dropper/3.png)

Now take a look at the s18 file

[![4](/images/Malware_Analysis/Heodo-Dropper/4.png)](/images/Malware_Analysis/Heodo-Dropper/4.png)

we can notice that there is a lot of junk code, and if we look further we can see a string pattern `//====dsfnnJJJsm388//=` (one of the many )that is used to obfuscate the vba code, let's find and replace them all !

[![5](/images/Malware_Analysis/Heodo-Dropper/5.png)](/images/Malware_Analysis/Heodo-Dropper/5.png)

Oh now we can assume that the malware wants to create a process, the string concatenated contains also another param :  `Bimqxgzblyrp.Fmgsnpdkhc` , if we remember `Bimqxgzblyrp` is a folder name, if we look back at the result of oledump we can see that in that folder there is a big file

[![6](/images/Malware_Analysis/Heodo-Dropper/6.png)](/images/Malware_Analysis/Heodo-Dropper/6.png)

``` 
oledump.py -s 14 -d emotet.bin > moreStrings
```
Now that we dumped the file we can open it and see the same pattern used before, so let's find them and replace them all

[![7](/images/Malware_Analysis/Heodo-Dropper/7.png)](/images/Malware_Analysis/Heodo-Dropper/7.png)

the data seems to be encrypted in base64, so fire up CyberChef and decrypt it !

[![8](/images/Malware_Analysis/Heodo-Dropper/8.png)](/images/Malware_Analysis/Heodo-Dropper/8.png)

We can see below that the result is a powershell script that contains a lot of IOC's.

[![9](/images/Malware_Analysis/Heodo-Dropper/9.png)](/images/Malware_Analysis/Heodo-Dropper/9.png)

This powershell script uses a foreach loop to iterate all the domains trying to download 
a malicious file, if the download success then it breaks the loop and starts the malicious process.

# Fast Behavioural Analysis 

I usually prefer to do the dynamic analysis first and then the static one, but in this case I thought it was better to do it in this way.
So now let's take a look at the sandobox’s results

## Connections view

In the image below we can see that the malware opened 2 connections: the first one to download an executable file,
the second one to upload data to a c2 server

[![10](/images/Malware_Analysis/Heodo-Dropper/10.png)](/images/Malware_Analysis/Heodo-Dropper/10.png)


## Process view

The malware runs a base64 powershell command to open an internet connection and then runs the executable downloaded

[![11](/images/Malware_Analysis/Heodo-Dropper/11.png)](/images/Malware_Analysis/Heodo-Dropper/11.png)



