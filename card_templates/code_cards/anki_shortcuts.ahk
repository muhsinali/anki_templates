#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.
#SingleInstance Force

!s::				; spoiler-ifies (in Anki html editor)
{
	Send ^c
	Sleep 50
	Send {Delete}
	Send {Raw}<span class="spoiler">%ClipBoard%
}
Return


!k::				; creates a code input (in Anki html editor)
{
	Send ^c
	Sleep 100
	Length := StrLen(Clipboard)
	Random, RandSeed, 10000000, 99999999
	Send {Delete}
	Send {Raw}<input maxlength='%Length%' name='%ClipBoard%_%RandSeed%' style='width: %Length%ch;'>
}
Return


!i::				; creates a code block (in Anki html editor)
{
	Send `<div class='exerciseprecontainer'`>`<pre`>
	Send ^v
	Sleep 100
}
Return