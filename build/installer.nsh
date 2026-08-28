!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
!macroend

!macro customInstall
  ${If} ${FileExists} "$INSTDIR\resources\installer\install-prerequisites.ps1"
    SetDetailsPrint both
    DetailPrint "Print Agent application files installed."
    DetailPrint "Checking Print Agent runtime prerequisites..."
    DetailPrint "Checking: SumatraPDF, IrfanView, ngrok, WinSpoolerHelper slot."
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
    SetDetailsPrint both
    DetailPrint "Print Agent prerequisite setup script was not found."
  ${EndIf}
!macroend

!macro customUnInstall
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--updated" $R1
  ${If} ${Errors}
    ClearErrors
    ${GetOptions} $R0 "/KEEP_APP_DATA" $R1
  ${EndIf}

  ${IfNot} ${Errors}
    SetDetailsPrint both
    DetailPrint "Preserving Print Agent local configuration and runtime data during upgrade."
  ${Else}
    SetDetailsPrint both
    DetailPrint "Removing Print Agent local configuration and runtime data..."

  ${If} ${FileExists} "$INSTDIR\resources\installer\uninstall-cleanup.ps1"
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\uninstall-cleanup.ps1"'
    Pop $0

    ${If} $0 != 0
      DetailPrint "Print Agent uninstall cleanup finished with warnings. Exit code: $0"

      ${IfNot} ${Silent}
        MessageBox MB_ICONEXCLAMATION|MB_OK "Print Agent was uninstalled, but one or more local data folders could not be removed automatically.$\r$\n$\r$\nClose any running Print Agent windows and delete these folders manually if needed:$\r$\n%APPDATA%\PrintAgent$\r$\n%LOCALAPPDATA%\PrintAgent"
      ${EndIf}
    ${Else}
      DetailPrint "Print Agent local data cleanup finished."
    ${EndIf}
  ${Else}
    DetailPrint "Print Agent uninstall cleanup script was not found. Running built-in cleanup fallback."
  ${EndIf}

  ${If} ${FileExists} "$APPDATA\PrintAgent"
    DetailPrint "Removing $APPDATA\PrintAgent"
    RMDir /r "$APPDATA\PrintAgent"
  ${EndIf}

  ${If} ${FileExists} "$LOCALAPPDATA\PrintAgent"
    DetailPrint "Removing $LOCALAPPDATA\PrintAgent"
    RMDir /r "$LOCALAPPDATA\PrintAgent"
  ${EndIf}

  ${If} ${FileExists} "$APPDATA\print-agent-desktop"
    DetailPrint "Removing $APPDATA\print-agent-desktop"
    RMDir /r "$APPDATA\print-agent-desktop"
  ${EndIf}

  ${If} ${FileExists} "$LOCALAPPDATA\print-agent-desktop"
    DetailPrint "Removing $LOCALAPPDATA\print-agent-desktop"
    RMDir /r "$LOCALAPPDATA\print-agent-desktop"
  ${EndIf}

  ${If} ${FileExists} "$APPDATA\Print Agent"
    DetailPrint "Removing $APPDATA\Print Agent"
    RMDir /r "$APPDATA\Print Agent"
  ${EndIf}

  ${If} ${FileExists} "$LOCALAPPDATA\Print Agent"
    DetailPrint "Removing $LOCALAPPDATA\Print Agent"
    RMDir /r "$LOCALAPPDATA\Print Agent"
  ${EndIf}
  ${EndIf}
!macroend
