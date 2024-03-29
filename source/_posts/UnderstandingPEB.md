---
layout: post
title: "Understanding the Windows PEB"
date: 2022-02-12
excerpt: During malware analysis, I often encounter shellcode that abuse the PEB structure to dinamically constructs it's own import table...
categories:
  - Windows Internals
toc: true
---

## Introduction

During malware analysis, I often encounter shellcode that abuse the PEB structure to dinamically constructs it's own import table.

The PEB (Process Environment Block), according to [MSDN](https://docs.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-peb) is a structure that contains process informations, but I prefer [Geoff Chapell's definition](https://www.geoffchappell.com/studies/windows/km/ntoskrnl/inc/api/pebteb/peb/index.htm) that describe the PEB structure like a process's user-mode representation created by the kernel and managed mostly in user mode, and in practice is used to share data between processes instead of creating an inter-process-communication (IPC).

PEB has been present in Windows since the introduction of Win2k.

## How to use

In all recent Win x86 versions, the FS register points to the TEB (Thread Environment Block) structure defined in [Winternl.h](https://docs.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-teb) like a structure that contains the running thread's informations similarly like PEB, and also visible using the public avaiable microsoft debug symbols.

```Python
0:000> dt ntdll!_TEB

   +0x000 NtTib            : _NT_TIB

   +0x01c EnvironmentPointer : Ptr32 Void

   +0x020 ClientId         : _CLIENT_ID

   +0x028 ActiveRpcHandle  : Ptr32 Void

   +0x02c ThreadLocalStoragePointer : Ptr32 Void

   +0x030 ProcessEnvironmentBlock : Ptr32 _PEB

   +0x034 LastErrorValue   : Uint4B

   +0x038 CountOfOwnedCriticalSections : Uint4B

   +0x03c CsrClientThread  : Ptr32 Void

   +0x040 Win32ThreadInfo  : Ptr32 Void

   +0x044 User32Reserved   : [26] Uint4B

   ...  <more>   ...
```

For all recents x64 windows version, the GS register stores the TEB address, you may wondering if these segment registers have some processor-defined purpose like CS (Code Segment) DS (Data Segment) ES(Destination Segment), the answer is no, but instead are given purpose by the OS's running, also their name was chosen to continue the alphabetic order😂.

*For more informations about the background history behind this read this interesting [SO thread](https://stackoverflow.com/questions/10810203/what-is-the-fs-gs-register-intended-for#:~:text=The%20registers%20FS%20and%20GS,to%20access%20thread%2Dspecific%20memory.).*

Now if you looked at the TEB structure above you may noticed that at offset 0x30 there is a pointer to a _PEB structure, let's take a look at this structure.

```Python
0:000> dt ntdll!_PEB

   +0x000 InheritedAddressSpace : UChar

   +0x001 ReadImageFileExecOptions : UChar

   +0x002 BeingDebugged    : UChar

   +0x003 BitField         : UChar

   +0x003 ImageUsesLargePages : Pos 0, 1 Bit

   +0x003 IsProtectedProcess : Pos 1, 1 Bit

   +0x003 IsImageDynamicallyRelocated : Pos 2, 1 Bit

   +0x003 SkipPatchingUser32Forwarders : Pos 3, 1 Bit

   +0x003 IsPackagedProcess : Pos 4, 1 Bit

   +0x003 IsAppContainer   : Pos 5, 1 Bit

   +0x003 IsProtectedProcessLight : Pos 6, 1 Bit

   +0x003 IsLongPathAwareProcess : Pos 7, 1 Bit

   +0x004 Mutant           : Ptr32 Void

   +0x008 ImageBaseAddress : Ptr32 Void

   +0x00c Ldr              : Ptr32 _PEB_LDR_DATA

   +0x010 ProcessParameters : Ptr32 _RTL_USER_PROCESS_PARAMETERS

   ... <more> ...
```

You can see a lot of important informations about the process i.e. the `BeingDebugged` field is used a lot from malware to avoid common dinamical analysis techniques that use the function `IsDebuggerPresent()` to check if the program is debugged, this function reversed using ghidra generates the following pseudocode:

```C
ulonglong IsDebuggerPresent(void)
{

  longlong in_GS_OFFSET;

  return (ulonglong)*(byte *)(*(longlong *)(in_GS_OFFSET + 0x60) + 2);

}
```

The program that I wrote below, in an x86 environment, does the same thing without importing the Kernel32.dll function in order to hide from static analysis of the import table.

<script src="https://gist.github.com/CaptWake/fbaf238bea17299bc65edcf94153591d.js"></script>

Becoming familiar with this structure is important because a lot of Windows functions just read the PEB and TEB informations, and you can use these structure to obfuscate code or to simply avoid additional dependencies.

Another interesting field is the `Ldr` located at offset 0xC, this is a pointer to a `_PEB_LDR_DATA` data structure that contains information about the loaded modules for the process, shellcode will typically walk this data structure to find the base address of loaded dlls.

```Python
0:000> dt ntdll!_PEB_LDR_DATA

   +0x000 Length           : Uint4B

   +0x004 Initialized      : UChar

   +0x008 SsHandle         : Ptr32 Void

   +0x00c InLoadOrderModuleList : _LIST_ENTRY

   +0x014 InMemoryOrderModuleList : _LIST_ENTRY

   +0x01c InInitializationOrderModuleList : _LIST_ENTRY

   +0x024 EntryInProgress  : Ptr32 Void

   +0x028 ShutdownInProgress : UChar

   +0x02c ShutdownThreadId : Ptr32 Void
```

According to [microsoft docs](https://docs.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-peb_ldr_data) the field `InMemoryOrderModuleList` represents the head of a doubly-linked list where each items in the list is a pointer to a `LDR_DATA_TABLE_ENTRY` data structure.

```Python
0:000> dt ntdll!_LDR_DATA_TABLE_ENTRY

   +0x000 InLoadOrderLinks : _LIST_ENTRY

   +0x008 InMemoryOrderLinks : _LIST_ENTRY

   +0x010 InInitializationOrderLinks : _LIST_ENTRY

   +0x018 DllBase          : Ptr32 Void

   +0x01c EntryPoint       : Ptr32 Void

   +0x020 SizeOfImage      : Uint4B

   +0x024 FullDllName      : _UNICODE_STRING

   +0x02c BaseDllName      : _UNICODE_STRING

   +0x034 FlagGroup        : [4] UChar

   +0x034 Flags            : Uint4B

   ... <more> ...
```

You may wondering why there are 3 double-linked lists, the response is that theoretically they should represent different things as their names suggest but in reality they are equals, these lists are defined following the [MSDN](https://docs.microsoft.com/en-us/windows/win32/api/ntdef/ns-ntdef-list_entry).

```C
typedef struct _LIST_ENTRY {

   struct _LIST_ENTRY *Flink;

   struct _LIST_ENTRY *Blink;

} LIST_ENTRY, *PLIST_ENTRY, *RESTRICTED_POINTER PRLIST_ENTRY;
```

Assuming a 32bit environment we can see that these struct has an 8byte size, why we need to know this? Because if we choose to use the `InMemoryOrderLinks` list when we follow this pointer it's taking us to `_LIST_ENTRY` structure `InMemoryOrderLinks` of the `_LDR_DATA_TABLE_ENTRY` of the next module that isn't the base of the structure, for this reason we need to subtract 8 bytes from that address in order to point correctly at the `_LDR_DATA_TABLE_ENTRY` struct.



## Case Study

### Scope

We are going to find the loaded modules of a simple program using winDbg to inspect them easily.

### Hands On

Open winDbg and attach a debugger on some process, and execute the following command to obtain `TEB` information, in my case:

```Python
0:000> dt ntdll!_TEB 0x003e0000

   +0x000 NtTib            : _NT_TIB

   +0x01c EnvironmentPointer : (null) 

   +0x020 ClientId         : _CLIENT_ID

   +0x028 ActiveRpcHandle  : (null) 

   +0x02c ThreadLocalStoragePointer : 0x0063c340 Void

   +0x030 ProcessEnvironmentBlock : 0x003dd000 _PEB

   +0x034 LastErrorValue   : 0

   +0x038 CountOfOwnedCriticalSections : 0

   +0x03c CsrClientThread  : (null) 

   +0x040 Win32ThreadInfo  : (null) 

   +0x044 User32Reserved   : [26] 0

   +0x0ac UserReserved     : [5] 0

   +0x0c0 WOW32Reserved    : 0x77817000 Void

   +0x0c4 CurrentLocale    : 0x410

   ... <more> ...
```

Now we can access and analyze the `PEB` structure using the address stored in the `PEB Address` field typing the following command:

```Python
0:000> dt ntdll!_PEB 0x003dd000

   +0x000 InheritedAddressSpace : 0 ''

   +0x001 ReadImageFileExecOptions : 0 ''

   +0x002 BeingDebugged    : 0x1 ''

   +0x003 BitField         : 0 ''

   +0x003 ImageUsesLargePages : 0y0

   +0x003 IsProtectedProcess : 0y0

   +0x003 IsImageDynamicallyRelocated : 0y0

   +0x003 SkipPatchingUser32Forwarders : 0y0

   +0x003 IsPackagedProcess : 0y0

   +0x003 IsAppContainer   : 0y0

   +0x003 IsProtectedProcessLight : 0y0

   +0x003 IsLongPathAwareProcess : 0y0

   +0x004 Mutant           : 0xffffffff Void

   +0x008 ImageBaseAddress : 0x00400000 Void

   +0x00c Ldr              : 0x77945d80 _PEB_LDR_DATA

   +0x010 ProcessParameters : 0x006323d0 _RTL_USER_PROCESS_PARAMETERS

   +0x014 SubSystemData    : (null) 

   ... <more> ...
```

Now remember that ldr field stores the address of `_PEB_LDR_DATA` data structure that contains informations about the loaded modules for this process.

```Python
0:000> dt ntdll!_PEB_LDR_DATA 0x77945d80 

   +0x000 Length           : 0x30

   +0x004 Initialized      : 0x1 ''

   +0x008 SsHandle         : (null) 

   +0x00c InLoadOrderModuleList : _LIST_ENTRY [ 0x634498 - 0x63b8c8 ]

   +0x014 InMemoryOrderModuleList : _LIST_ENTRY [ 0x6344a0 - 0x63b8d0 ]

   +0x01c InInitializationOrderModuleList : _LIST_ENTRY [ 0x6343a0 - 0x634888 ]

   +0x024 EntryInProgress  : (null) 

   +0x028 ShutdownInProgress : 0 ''

   +0x02c ShutdownThreadId : (null) 
```

Now it's equal to choose to follow the `InLoadOrderModuleList` or `InMemoryOrderModuleList`, in this case I choosed to follow `InMemoryOrderModuleList`, it could be a good exercise shows that these lists are equivalents.

So it's important now to remember what I said before, when we use the `InMemoryOrderLinks` we need to subtract 8bytes if we are in a 32bit environment, because otherwise we encounter the following problem:

```Python
0:000> dt ntdll!_LDR_DATA_TABLE_ENTRY 0x6344a0

   +0x000 InLoadOrderLinks : _LIST_ENTRY [ 0x634398 - 0x77945d94 ]

   +0x008 InMemoryOrderLinks : _LIST_ENTRY [ 0x0 - 0x0 ]

   +0x010 InInitializationOrderLinks : _LIST_ENTRY [ 0x400000 - 0x4b8f6b ]

   +0x018 DllBase          : 0x0013f000 Void

   +0x01c EntryPoint       : 0x00760074 Void

   +0x020 SizeOfImage      : 0x632898

   +0x024 FullDllName      : _UNICODE_STRING "ac_client.exe"

   +0x02c BaseDllName      : _UNICODE_STRING "--- memory read error at address 0x0000ffff ---"

   +0x034 FlagGroup        : [4]  "???"

   +0x034 Flags            : 0x77945be0
 ```

 You can see that the structure is incoerent, we can also deduce that `FullDllName` contains the value of `BaseDllName` so probably the structure was shifted of a number of bytes equals to 0x2c - 0x24 = 8, cool! We demonstrate that to allineate correctly the structure we need to subtract 8 bytes

 ```Python
 0:000> dt ntdll!_LDR_DATA_TABLE_ENTRY (0x6344a0 - 0x8)

   +0x000 InLoadOrderLinks : _LIST_ENTRY [ 0x634390 - 0x77945d8c ]

   +0x008 InMemoryOrderLinks : _LIST_ENTRY [ 0x634398 - 0x77945d94 ]

   +0x010 InInitializationOrderLinks : _LIST_ENTRY [ 0x0 - 0x0 ]

   +0x018 DllBase          : 0x00400000 Void

   +0x01c EntryPoint       : 0x004b8f6b Void

   +0x020 SizeOfImage      : 0x13f000

   +0x024 FullDllName      : _UNICODE_STRING "C:\Program Files (x86)\AssaultCube\bin_win32\ac_client.exe"

   +0x02c BaseDllName      : _UNICODE_STRING "ac_client.exe"

   +0x034 FlagGroup        : [4]  "???"

   +0x034 Flags            : 0x800022cc

   ... <more> ...
 ```

 Now we can see that the structure seems correct, if we follow the linked list we would obtain the following modules, let's try to extract the following modules!

 ```Python
 0:000> dt ntdll!_LDR_DATA_TABLE_ENTRY (0x634398 - 0x8)

   +0x000 InLoadOrderLinks : _LIST_ENTRY [ 0x634878 - 0x634498 ]

   +0x008 InMemoryOrderLinks : _LIST_ENTRY [ 0x634880 - 0x6344a0 ]

   +0x010 InInitializationOrderLinks : _LIST_ENTRY [ 0x634c58 - 0x77945d9c ]

   +0x018 DllBase          : 0x77820000 Void

   +0x01c EntryPoint       : (null) 

   +0x020 SizeOfImage      : 0x1a3000

   +0x024 FullDllName      : _UNICODE_STRING "C:\WINDOWS\SYSTEM32\ntdll.dll"

   +0x02c BaseDllName      : _UNICODE_STRING "ntdll.dll"

   +0x034 FlagGroup        : [4]  "???"

   +0x034 Flags            : 0xa2c4

   ... <more> ...
 ```

 We can clearly see that the second loaded module is the `ntdll.dll`, in fact this is the Windows core library and it should be loaded before any other dll libraries, except `ntoskrnl.dll`.

 ```Python
 0:000> dt ntdll!_LDR_DATA_TABLE_ENTRY (0x634880 - 0x8)

   +0x000 InLoadOrderLinks : _LIST_ENTRY [ 0x634c48 - 0x634390 ]

   +0x008 InMemoryOrderLinks : _LIST_ENTRY [ 0x634c50 - 0x634398 ]

   +0x010 InInitializationOrderLinks : _LIST_ENTRY [ 0x77945d9c - 0x634c58 ]

   +0x018 DllBase          : 0x762a0000 Void

   +0x01c EntryPoint       : 0x762bf640 Void

   +0x020 SizeOfImage      : 0xf0000

   +0x024 FullDllName      : _UNICODE_STRING "C:\WINDOWS\System32\KERNEL32.DLL"

   +0x02c BaseDllName      : _UNICODE_STRING "KERNEL32.DLL"

   +0x034 FlagGroup        : [4]  "???"

   +0x034 Flags            : 0xca2cc

   ... <more> ...
 ```

The third loaded module is `Kernel32.dll`, keep in mind that the modules are loaded following this pattern:

- Exe module 

- ntdll.dll

- kernel32.dll



The rest of the modules depends on the program flow, dependencies, ecc.., it's very important this concept because the majority of the shellcode that I analyze always retrieve the base address of the kernel32.dll module in order to call i.e. `GetProcAddress`, `LoadLibrary`.



## Final Thoughts

Understand the way Processes and Threads are represented helps analyzing malicious code, but also writing efficient code from a programming perspective.
