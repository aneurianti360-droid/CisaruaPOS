' CisaruaPOS Launcher - menjalankan server diam-diam (tanpa jendela)
' Tidak perlu admin. Dipanggil otomatis saat Windows login.
Dim ws
Set ws = CreateObject("Wscript.Shell")
ws.Run "cmd /c cd /d ""C:\Users\ADMIN\Documents\Default Project"" && node server.js", 0, False
Set ws = Nothing