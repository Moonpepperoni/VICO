i = 0
STARTLOOP: if i == 10 goto ENDLOOP
if i != 4 goto ELSEIF
a = i + 5
goto ENDIF
ELSEIF: if i != 6 goto ELSE
a = a + 10
goto ENDIF
ELSE: if i != 8 goto ENDIF
a = a + 20
ENDIF: i = i + 1
goto STARTLOOP
ENDLOOP: result = a
