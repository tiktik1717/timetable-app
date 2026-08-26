# Agent Context Optimization — 23.08.2026

## מטרה
להפחית את צריכת ה-input tokens של Scheduling Agent בלי להסיר מידע חיוני לתפעולו.

## ממצאים לפני השינוי
בדיקת משתמש אמיתית הראתה כ-48.5K input tokens לקריאה פשוטה.
הגורם המרכזי היה schedule snapshot מלא במבנה JSON מילולי וחזרתי, יחד עם prompt ארוך והיסטוריית שיחה מלאה.

### מדידה על Golden Reference (775 placements)
- teacherScheduleSummary הישן, JSON pretty: 110,624 chars
- אותו מבנה ללא whitespace: 55,443 chars
- המבנה הקומפקטי החדש: 20,493 chars
- הוראות Agent הישנות: ~6,019 chars
- הוראות Agent החדשות: ~1,390 chars

## שינויים

### 1. teacher-placements-v2
במקום אובייקט חוזר לכל placement:
```json
{"hour":3,"className":"ד1","unitId":"unit-145","unitType":"..."}
```
נשלח wire format קומפקטי:
```json
{
  "format":"teacher-placements-v2",
  "fields":["day","hour","className","unitId"],
  "byTeacher":{
    "36":[["ה",4,"ד1","unit-145"]]
  }
}
```
שמות המורים כבר נמצאים ב-entitySummary ולכן אינם משוכפלים ב-snapshot.

### 2. JSON ללא pretty-print
כל רכיבי context דינמיים נשלחים ב-JSON מינימלי ללא indentation.

### 3. קיצור system instructions
הוסרו הסברים כפולים על validator ו-approvedExceptions תוך שמירת כל כללי ההתנהגות המהותיים.

### 4. היסטוריית שיחה מוגבלת
נשלחות עד 10 הודעות שיחה אחרונות. מצב המערכת, rules, exceptions ו-validator נשלחים בנפרד ולכן אינם תלויים בהיסטוריה ישנה.

### 5. תיקון current message normalization
הודעת המשתמש הנוכחית נשלחת עכשיו בדיוק פעם אחת:
- אם caller כבר כלל אותה ב-conversationHistory — היא מוסרת מההיסטוריה ומתווספת פעם אחת.
- במסלול automatic attempt evaluation, שבו היא לא הייתה ב-history, היא מתווספת כעת. זה גם מתקן בעיה קודמת שבה הודעת evaluation עצמה לא בהכרח הגיעה למודל.

### 6. Context telemetry
כל API response כולל כעת:
- contextChars
- contextProfile.instructionsChars
- contextProfile.conversationChars
- contextProfile.developerChars
- validationChars
- formalRuleChars
- rulesChars
- exceptionsChars
- entitiesChars
- teacherScheduleChars

ב-UI מוצג גם `context X chars` לצד token telemetry.

## בדיקות
- `node --check netlify/functions/scheduling-agent.js` — עבר.
- Validator CLI הורץ מחדש על Golden Reference:
  - 775/775
  - errors: 0
  - warnings: 0
  - valid: true
- השינוי אינו משנה schedule, Validator או schoolData.

## בדיקת קבלה מומלצת אצל המשתמש
שלח לסוכן שוב את אותה שאלה:
"בדוק את מצב מערכת השעות הנוכחית ותן לי סיכום קצר."

לפני האופטימיזציה נמדדו בקירוב:
- input: 48,544 tokens
- output: 212

יש להשוות את הקריאה החדשה. בנוסף UI יציג את גודל ה-context בתווים.
