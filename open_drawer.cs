using System;
using System.Runtime.InteropServices;

class Program
{
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    static void Main()
    {
        string printerName = "EPSON TM-T20III Receipt";
        byte[] bytes = new byte[] { 0x1B, 0x70, 0x30, 0x37, 0x79 };
        IntPtr printer = IntPtr.Zero;

        try
        {
            if (OpenPrinter(printerName, out printer, IntPtr.Zero))
            {
                int bytesWritten;
                if (WritePrinter(printer, bytes, bytes.Length, out bytesWritten))
                {
                    Console.WriteLine("Příkaz pro otevření zásuvky byl úspěšně odeslán.");
                }
                else
                {
                    Console.WriteLine("Chyba při odesílání příkazu: " + Marshal.GetLastWin32Error());
                }
            }
            else
            {
                Console.WriteLine("Nelze otevřít tiskárnu: " + Marshal.GetLastWin32Error());
            }
        }
        finally
        {
            if (printer != IntPtr.Zero)
            {
                ClosePrinter(printer);
            }
        }
    }
} 