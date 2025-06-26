import win32print

printer_name = "EPSON TM-T20III Receipt"
command = bytes([27, 112, 48, 55, 121])  # ESC p 0 7 y

printer = win32print.OpenPrinter(printer_name)
try:
    win32print.StartDocPrinter(printer, 1, ("Open Drawer", None, "RAW"))
    win32print.StartPagePrinter(printer)
    win32print.WritePrinter(printer, command)
    win32print.EndPagePrinter(printer)
    win32print.EndDocPrinter(printer)
finally:
    win32print.ClosePrinter(printer) 