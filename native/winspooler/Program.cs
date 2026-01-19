using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace WinSpoolerHelper
{
    /// <summary>
    /// Windows Spooler RAW printing helper for ESC/POS thermal printers
    /// Uses Windows Print Spooler API (winspool.drv) to send raw bytes directly to printer
    /// </summary>
    class Program
    {
        #region WinAPI Declarations

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct DOCINFOW
        {
            [MarshalAs(UnmanagedType.LPWStr)]
            public string pDocName;
            [MarshalAs(UnmanagedType.LPWStr)]
            public string pOutputFile;
            [MarshalAs(UnmanagedType.LPWStr)]
            public string pDatatype;
        }

        [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

        [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOW pDocInfo);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        #endregion

        static int Main(string[] args)
        {
            try
            {
                // Parse command-line arguments
                if (args.Length < 2)
                {
                    Console.Error.WriteLine("ERROR: Invalid arguments");
                    Console.Error.WriteLine("Usage: WinSpoolerHelper.exe <printerName> <filePath> [jobName]");
                    Console.Error.WriteLine("   or: WinSpoolerHelper.exe --check <printerName>");
                    return 1;
                }

                string command = args[0];

                // Check printer availability (for validation)
                if (command == "--check" || command == "-c")
                {
                    if (args.Length < 2)
                    {
                        Console.Error.WriteLine("ERROR: Printer name required for --check");
                        return 1;
                    }
                    
                    string printerName = args[1];
                    bool available = CheckPrinterAvailability(printerName);
                    
                    if (available)
                    {
                        Console.WriteLine("OK");
                        return 0;
                    }
                    else
                    {
                        Console.Error.WriteLine($"ERROR: Printer '{printerName}' not available");
                        return 1;
                    }
                }

                // Normal printing mode
                string printer = args[0];
                string filePath = args[1];
                string jobName = args.Length > 2 ? args[2] : "ESC/POS Receipt";

                // Validate inputs
                if (string.IsNullOrWhiteSpace(printer))
                {
                    Console.Error.WriteLine("ERROR: Printer name is empty");
                    return 1;
                }

                if (string.IsNullOrWhiteSpace(filePath))
                {
                    Console.Error.WriteLine("ERROR: File path is empty");
                    return 1;
                }

                if (!File.Exists(filePath))
                {
                    Console.Error.WriteLine($"ERROR: File not found: {filePath}");
                    return 1;
                }

                // Read file data
                byte[] data = File.ReadAllBytes(filePath);
                
                if (data.Length == 0)
                {
                    Console.Error.WriteLine("ERROR: File is empty");
                    return 1;
                }

                // Send to printer
                bool success = SendRawDataToPrinter(printer, data, jobName);

                if (success)
                {
                    Console.WriteLine($"OK: {data.Length} bytes sent to printer '{printer}'");
                    return 0;
                }
                else
                {
                    return 1; // Error already written in SendRawDataToPrinter
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"ERROR: Unhandled exception: {ex.Message}");
                return 1;
            }
        }

        /// <summary>
        /// Send raw bytes to Windows printer using Spooler API
        /// </summary>
        static bool SendRawDataToPrinter(string printerName, byte[] data, string jobName)
        {
            IntPtr hPrinter = IntPtr.Zero;
            
            try
            {
                // Open printer handle
                if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
                {
                    int error = Marshal.GetLastWin32Error();
                    Console.Error.WriteLine($"ERROR: Failed to open printer '{printerName}'. Win32 Error: {error}");
                    Console.Error.WriteLine("Check if printer name is correct and printer is installed.");
                    return false;
                }

                // Setup document info
                DOCINFOW docInfo = new DOCINFOW
                {
                    pDocName = jobName,
                    pOutputFile = null,
                    pDatatype = "RAW" // CRITICAL: Must be "RAW" for direct byte stream
                };

                // Start document
                int jobId = StartDocPrinter(hPrinter, 1, ref docInfo);
                if (jobId == 0)
                {
                    int error = Marshal.GetLastWin32Error();
                    Console.Error.WriteLine($"ERROR: StartDocPrinter failed. Win32 Error: {error}");
                    return false;
                }

                // Start page
                if (!StartPagePrinter(hPrinter))
                {
                    int error = Marshal.GetLastWin32Error();
                    Console.Error.WriteLine($"ERROR: StartPagePrinter failed. Win32 Error: {error}");
                    EndDocPrinter(hPrinter);
                    return false;
                }

                // Write data to printer
                IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
                try
                {
                    Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);

                    int bytesWritten = 0;
                    if (!WritePrinter(hPrinter, pUnmanagedBytes, data.Length, out bytesWritten))
                    {
                        int error = Marshal.GetLastWin32Error();
                        Console.Error.WriteLine($"ERROR: WritePrinter failed. Win32 Error: {error}");
                        return false;
                    }

                    if (bytesWritten != data.Length)
                    {
                        Console.Error.WriteLine($"WARNING: Partial write. Expected {data.Length} bytes, wrote {bytesWritten} bytes");
                    }
                }
                finally
                {
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                }

                // End page
                if (!EndPagePrinter(hPrinter))
                {
                    int error = Marshal.GetLastWin32Error();
                    Console.Error.WriteLine($"ERROR: EndPagePrinter failed. Win32 Error: {error}");
                }

                // End document
                if (!EndDocPrinter(hPrinter))
                {
                    int error = Marshal.GetLastWin32Error();
                    Console.Error.WriteLine($"ERROR: EndDocPrinter failed. Win32 Error: {error}");
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"ERROR: Exception during printing: {ex.Message}");
                return false;
            }
            finally
            {
                // Always close printer handle
                if (hPrinter != IntPtr.Zero)
                {
                    ClosePrinter(hPrinter);
                }
            }
        }

        /// <summary>
        /// Check if printer is available (can be opened)
        /// </summary>
        static bool CheckPrinterAvailability(string printerName)
        {
            IntPtr hPrinter = IntPtr.Zero;
            
            try
            {
                bool opened = OpenPrinter(printerName, out hPrinter, IntPtr.Zero);
                
                if (opened && hPrinter != IntPtr.Zero)
                {
                    ClosePrinter(hPrinter);
                    return true;
                }
                
                return false;
            }
            catch
            {
                return false;
            }
            finally
            {
                if (hPrinter != IntPtr.Zero)
                {
                    try
                    {
                        ClosePrinter(hPrinter);
                    }
                    catch { }
                }
            }
        }
    }
}
