# פקודות הפרויקט

מדריך הפעלה מעשי ל-Chrome Browser. כל פקודה כאן נבדקה בפועל על המחשב הזה.

---

## 1. הכנה חד-פעמית — חובה

שני משתני סביבה שבלעדיהם **שום בנייה לא תעבוד**.

**למה `GRADLE_USER_HOME`:** שם המשתמש שלך בווינדוס הוא `מתנאל ממן`. Gradle מייצר קובצי `.bat` שמכילים את נתיב המטמון מקודד ב-UTF-8, בעוד `cmd.exe` קורא קובצי batch ב-OEM codepage — הנתיב מתעוות והקבצים לא נמצאים. זה אומת ישירות מול הבייטים בקובץ שנוצר.

**למה `JAVA_TOOL_OPTIONS`:** ג'אווה מממשת NIO selectors ב-Windows דרך קובץ socket מסוג AF_UNIX, וברירת המחדל של מיקום הקובץ נכשלת על המחשב הזה — `Pipe.open()` זורק `Unable to establish loopback connection` גם בתוכנית בת ארבע שורות. הסיבה המדויקת לא מבוררת: זה **לא** נובע מהעברית בנתיב, כי הבדיקה נכשלה גם כשהנתיב היה באנגלית וגם בכפיית `java.io.tmpdir` לתיקייה אחרת. מה שידוע: הפניית `jdk.net.unixdomain.tmpdir` לתיקייה ייעודית פותרת.

הכי טוב להגדיר אותם **קבוע** ב-Windows: חיפוש → "Edit environment variables for your account" → New:

```
JAVA_TOOL_OPTIONS = -Djdk.net.unixdomain.tmpdir=C:/temp/jdksock
GRADLE_USER_HOME  = C:/gradle-home
```

`JAVA_TOOL_OPTIONS` משפיע על **כל** כלי ג'אווה, לא רק על הפרויקט הזה — בלעדיו גם Android Studio ו-Maven ישברו.

אם אתה מעדיף להגדיר ידנית בכל טרמינל (Git Bash):

```bash
export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=C:/temp/jdksock"
```

```bash
export GRADLE_USER_HOME="C:/gradle-home"
```

> התיקייה `C:/temp/jdksock` חייבת להתקיים. אם נמחקה: `mkdir -p /c/temp/jdksock`

---

## 2. עבודה יומיומית

הזרימה הרגילה: מדליקים אמולטור, מדליקים Metro, פותחים את האפליקציה. **לא צריך לבנות מחדש** לשינויי JS.

### הדלקת האמולטור

```bash
"C:/Android/Sdk/emulator/emulator.exe" -avd Pixel8
```

ייפתח חלון עם טלפון. **להשאיר פתוח** — סגירת החלון מכבה את האמולטור.
ההפעלה הראשונה אחרי אתחול לוקחת דקה-שתיים.

### הדלקת Metro

```bash
npx expo start --dev-client
```

זה השרת שמגיש את קוד ה-JS. כל שינוי בקוד מתעדכן במכשיר תוך שנייה, בלי בנייה.

### פתיחת האפליקציה

באמולטור: מחליקים מלמטה למעלה ולוחצים על **Chrome Browser**.

או מכאן:

```bash
adb shell monkey -p com.matan.chromebrowser -c android.intent.category.LAUNCHER 1
```

אם מופיע מסך עם `http://10.0.2.2:8081` — זה מסך הפתיחה של expo-dev-client. לוחצים על השורה עם הנקודה הירוקה.

### מה מתעדכן חי ומה לא

| שינוי | דורש |
|---|---|
| קומפוננטות, hooks, utils, סגנונות | כלום — מיידי |
| `src/utils/injectedScripts.ts` | רענון הדף בתוך הדפדפן |
| `app.json`, חבילה עם קוד נייטיב, `android/` | בנייה מחדש |

---

## 3. בנייה

### בדיקת טיפוסים

```bash
npx tsc --noEmit
```

הכי מהיר לתפוס שגיאות. להריץ לפני כל בנייה.

### APK לפיתוח

```bash
cd android && ./gradlew.bat app:assembleDebug -x lint -x test
```

התוצר: `android/app/build/outputs/apk/debug/app-debug.apk`
טוען JS מ-Metro, לכן צריך אותו רץ.

### APK לשחרור

```bash
cd android && ./gradlew.bat app:assembleRelease -x lint -x test
```

התוצר: `android/app/build/outputs/apk/release/app-release.apk` (כ-82MB)
ה-JS מוטמע בפנים, לא צריך Metro. ProGuard ומינימיזציה פעילים.

**כאן חיים באגים שלא קיימים ב-debug** — ProGuard מוחק מחלקות, תזמון ה-JS המוזרק משתנה. תמיד לבדוק את ה-release לפני הפצה.

### התקנה על האמולטור

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`-r` מחליף גרסה קיימת. למעבר בין debug ל-release ולהפך זה עובד כי שניהם חתומים באותו מפתח.

### ניקוי ובנייה מאפס

```bash
cd android && ./gradlew.bat clean
```

רק כשמשהו נתקע. בנייה מלאה אחר כך לוקחת 5-15 דקות.

### יצירה מחדש של הפרויקט הנייטיב

```bash
npx expo prebuild -p android --clean
```

**מוחק ומייצר מחדש את `android/`.** צריך רק אחרי שינוי ב-`app.json` או בחבילות נייטיב.
`android/` מנוהל ב-git, אז אחרי הרצה כדאי `git diff android/` כדי לראות מה השתנה.

---

## 4. אימות ה-APK

### בדיקת חתימה

```bash
"C:/Android/Sdk/build-tools/35.0.0/apksigner.bat" verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

כרגע חתום ב**מפתח הדיבאג** (`CN=Android Debug`) — מתאים להתקנה עצמית, **לא ל-Google Play**.

### פרטי החבילה

```bash
"C:/Android/Sdk/build-tools/35.0.0/aapt2.exe" dump badging android/app/build/outputs/apk/release/app-release.apk
```

מציג package name, versionCode, versionName, הרשאות.

---

## 5. הצצה למצב האפליקציה במכשיר

שימושי מאוד לדיבאג — קורא את ה-AsyncStorage האמיתי. עובד רק על בילד debug.

### הכרטיסיות הפתוחות והכתובות שלהן

```bash
adb shell "run-as com.matan.chromebrowser sqlite3 databases/RKStorage \"select value from catalystLocalStorage where key='@browser_tabs'\""
```

### מטמון הסינון מבוסס הרשת

```bash
adb shell "run-as com.matan.chromebrowser sqlite3 databases/RKStorage \"select value from catalystLocalStorage where key='@browser_dns_cache'\""
```

### כל המפתחות השמורים

```bash
adb shell "run-as com.matan.chromebrowser sqlite3 databases/RKStorage \"select key from catalystLocalStorage\""
```

מפתחות קיימים: `@browser_pin`, `@browser_blacklist`, `@browser_autoblock`, `@browser_dns_filter_enabled`, `@browser_dns_cache`, `@browser_downloads`, `@browser_history`, `@browser_bookmarks`, `@browser_tabs`, `@browser_active_tab_id`

### לוגים

```bash
adb logcat -d -t 300 | grep -aiE "ReactNativeJS|FATAL|AndroidRuntime"
```

### צילום מסך

```bash
adb exec-out screencap -p > screen.png
```

---

## 6. אמולטור — ניהול

### רשימת מכשירים וירטואליים

```bash
"C:/Android/Sdk/emulator/emulator.exe" -list-avds
```

### מכשירים מחוברים

```bash
adb devices -l
```

### יצירת אמולטור חדש (אם Pixel8 נמחק)

```bash
"C:/Android/Sdk/cmdline-tools/latest/bin/avdmanager.bat" create avd -n Pixel8 -k "system-images;android-35;google_apis;x86_64" -d pixel_8
```

אם ה-system image חסר, קודם:

```bash
"C:/Android/Sdk/cmdline-tools/latest/bin/sdkmanager.bat" "system-images;android-35;google_apis;x86_64"
```

---

## 7. תקלות מוכרות ופתרונן

### `java.io.IOException: Unable to establish loopback connection`

`JAVA_TOOL_OPTIONS` לא מוגדר. ראה סעיף 1.
זו לא בעיה של Gradle — תוכנית ג'אווה שקוראת רק ל-`Pipe.open()` תיכשל באותה צורה.

### `ClassNotFoundException: com.google.prefab.cli.AppKt`

`GRADLE_USER_HOME` לא מוגדר, והמטמון יושב תחת נתיב עם עברית. ראה סעיף 1.

### `npx expo run:android` נכשל על `emulator-5562`

אמולטור רפאים. השירות **NTKDaemon** (אודיו של Nahimic, מגיע עם לוחות MSI/ASUS) מאזין על פורט 5563, ו-adb סורק פורטים 5555–5585 ומניח שפורט אי-זוגי הוא ערוץ adb של אמולטור.

הדרך העוקפת — לבנות ולהתקין ידנית במקום `expo run:android` (סעיף 3). זה מדלג על שלב זיהוי המכשירים של Expo.

לפתרון קבוע צריך לעצור את שירות NTKDaemon.

### `avdmanager`: `Could not load devices from ... devices.xml`

רעש בלבד. המכשיר הווירטואלי **נוצר בהצלחה** למרות השגיאה. אימות:

```bash
"C:/Android/Sdk/emulator/emulator.exe" -list-avds
```

### `ERROR | avdInfo_setLastRunQemuVersion: Could not write file`

גם זה רעש — האמולטור לא הצליח לכתוב קובץ אבחון בגלל העברית בנתיב. עולה כרגיל.

### הממשק מוצג הפוך בהפעלה הראשונה

באג ידוע שלא תוקן. במכשיר עם locale עברי, ההפעלה הראשונה אחרי התקנה מציגה ממשק משוקף; מההפעלה השנייה זה תקין.

הסיבה: `I18nManager.allowRTL(false)` ב-`App.tsx` רץ ב-JS, אבל אנדרואיד קובע את כיוון הפריסה לפני ש-JS מתחיל.

התיקון הוא `android:supportsRtl="false"` במניפסט — דורש config plugin ובנייה מחדש.

### שגיאות Metro מוזרות

בדוק גרסת Node:

```bash
node -v
```

`.nvmrc` דורש 20.19.4. Expo SDK 54 נתמך רשמית על Node 20/22.

---

## 8. בדיקת תלויות

### התאמה ל-SDK

```bash
npx expo install --check
```

מדווח על חבילות בגרסה לא תואמת ל-Expo SDK 54.

### תיקון אוטומטי

```bash
npx expo install --fix
```

מיישר את כולן. **מומלץ להריץ `npx expo prebuild -p android --clean` אחרי**, אם התעדכנה חבילה עם קוד נייטיב.
