!macro customInstall
  ${If} ${FileExists} "$INSTDIR\resources\installer\install-prerequisites.ps1"
    DetailPrint "Checking Print Agent printer prerequisites..."
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\install-prerequisites.ps1"'
    Pop $0

    ${If} $0 != 0
      DetailPrint "Print Agent prerequisite setup finished with warnings. Exit code: $0"

      ${IfNot} ${Silent}
        ReadEnvStr $1 "LOCALAPPDATA"
        ${If} $1 == ""
          StrCpy $1 "%LOCALAPPDATA%"
        ${EndIf}
        MessageBox MB_ICONEXCLAMATION|MB_OK "Print Agent was installed, but one or more printer prerequisites could not be installed or updated automatically.$\r$\n$\r$\nOpen Print Agent and check this log:$\r$\n$1\PrintAgent\logs\installer-prerequisites.log"
      ${EndIf}
    ${Else}
      DetailPrint "Print Agent printer prerequisites are ready."
    ${EndIf}
  ${Else}
    DetailPrint "Print Agent prerequisite setup script was not found."
  ${EndIf}
!macroend
