; Extra Start menu shortcut (owner, 2026-11-22): resets the admin account's
; password to CHANGE_ME after the person confirms (electron/main/admin-reset.js).
!macro customInstall
  CreateShortCut "$SMPROGRAMS\Reset HSUSA TMS admin password.lnk" "$INSTDIR\HSUSA TMS.exe" "--reset-admin" "$INSTDIR\HSUSA TMS.exe" 0
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Reset HSUSA TMS admin password.lnk"
!macroend
