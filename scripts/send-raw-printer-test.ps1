param(
  [Parameter(Mandatory=$true)]
  [string]$PrinterName,

  [ValidateSet("receipt", "drawer")]
  [string]$Mode = "receipt"
)

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrinterBridge
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int Send(string printerName, byte[] bytes, string documentName)
    {
        IntPtr hPrinter = IntPtr.Zero;
        IntPtr unmanagedBytes = IntPtr.Zero;
        bool docStarted = false;
        bool pageStarted = false;

        try
        {
            if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            DOCINFOA docInfo = new DOCINFOA();
            docInfo.pDocName = documentName;
            docInfo.pDataType = "RAW";

            if (!StartDocPrinter(hPrinter, 1, docInfo))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            docStarted = true;

            if (!StartPagePrinter(hPrinter))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            pageStarted = true;

            unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);

            int written;
            if (!WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out written))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            return written;
        }
        finally
        {
            if (unmanagedBytes != IntPtr.Zero)
            {
                Marshal.FreeCoTaskMem(unmanagedBytes);
            }

            if (pageStarted)
            {
                EndPagePrinter(hPrinter);
            }

            if (docStarted)
            {
                EndDocPrinter(hPrinter);
            }

            if (hPrinter != IntPtr.Zero)
            {
                ClosePrinter(hPrinter);
            }
        }
    }
}
'@

Add-Type -TypeDefinition $source

if ($Mode -eq "drawer") {
  $bytes = [byte[]](0x1b, 0x70, 0x00, 0x19, 0xfa)
  $documentName = "Print Agent RAW drawer pulse"
} else {
  $text = @"
PRINT AGENT RAW TEST
====================

Printer: $PrinterName
Printed: $(Get-Date -Format o)

If this printed, Windows RAW spooler output works.



"@
  $body = [System.Text.Encoding]::ASCII.GetBytes($text)
  $bytes = [byte[]](0x1b, 0x40) + $body + [byte[]](0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00)
  $documentName = "Print Agent RAW receipt test"
}

$written = [RawPrinterBridge]::Send($PrinterName, $bytes, $documentName)
Write-Host "Sent $written raw bytes to '$PrinterName'."
