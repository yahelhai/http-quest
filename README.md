# HTTP Quest

משחק דפדפן ללימוד HTTP ו-REST, בנוי סביב מאגר סרטים ובמאים (movies ו-directors). המשחק בנוי מ-11 שלבים, כל שלב מציג משימה, ומהשחקן מצפים לבנות בקשת HTTP אמיתית (method, path, route params, query params, body) ולשלוח אותה אל שרת Node.js אמיתי. התשובה שמוצגת היא תשובת השרת בפועל, כולל Status Code, ולא הדמיה. הממשק דו-לשוני, עברית ואנגלית, עם מתג שפה שמחליף גם את טקסטי השלבים. הפרויקט הוגש כמטלה 3 בקורס פיתוח Web.

## הרצה

דרישה מוקדמת יחידה: Node.js גרסה 20 ומעלה. אין תלות בבסיס נתונים או בשירות חיצוני.

```bash
npm install
```

```bash
npm start
```

לאחר מכן לפתוח בדפדפן:

```
http://localhost:3000
```

להרצה על פורט אחר:

```bash
PORT=4000 npm start
```

להרצה בזמן פיתוח, עם הפעלה מחדש אוטומטית בכל שינוי קובץ (`node --watch`):

```bash
npm run dev
```

להרצת חבילת הבדיקות האוטומטיות:

```bash
npm test
```

הפרויקט הוא אפליקציית שרת (Express), ולכן הוא רץ רק מקומית או על שירות שמריץ Node.js. אי אפשר להגיש אותו כ-GitHub Pages, כי GitHub Pages מגיש קבצים סטטיים בלבד ואין בו שום Node.js בצד השרת.

## מגישים

- יהל חי
- סיוון גרונר

## איך המשחק עובד

כל שלב מציג שני חלקים: **הרעיון** (הסבר קצר על מושג ה-HTTP הרלוונטי) ו**המשימה** (מה בדיוק צריך לשלוח). מתחת לזה נמצא בונה הבקשה: שדה Method (select), שדה Path עם קידומת קבועה של `/api/`, שורות Query דינמיות (מפתח וערך, ניתן להוסיף ולהסיר), ותיבת Body בפורמט JSON שמתאפשרת רק כש-Method היא POST, PUT או PATCH. לחיצה על **שלח** שולחת בקשת `fetch` אמיתית לשרת, ומה שמוצג אחר כך הוא בדיוק מה שהשרת החזיר: Status Code, כותרות נבחרות, וגוף התשובה (מפורמט אם הוא JSON תקין).

השיפוט על נכונות הבקשה מתבצע **אך ורק בצד השרת**. הלקוח לא בודק שום דבר בעצמו מלבד תחביר JSON בסיסי לצורך חוויית משתמש (ראו בהמשך). הפרוטוקול בין הלקוח לשרת הוא כותרות HTTP, לא עטיפה של גוף התשובה:

- כל בקשה ששייכת לשלב נושאת כותרת בקשה `X-Quest-Level` עם מזהה השלב הנוכחי.
- השרת מחזיר כותרת תשובה `X-Quest-Result` עם הערך `pass` או `fail`.
- כשהתוצאה `fail`, מתווספת גם כותרת `X-Quest-Hint` עם קוד רמז קצר, למשל `wrong-method` או `missing-query:genre`.

הבחירה בכותרות ולא בעטיפת הגוף היא מכוונת: תשובת ה-API נשארת בדיוק כפי שהיא, זהה למה שהיה חוזר מ-`curl` על אותה בקשה בדיוק, בלי שום שכבת "עטיפה" מלאכותית שמסתירה את התשובה האמיתית. הלקוח (`public/js/game.js`) רק ממפה את קוד הרמז למשפט הסבר בשפת הממשק, מתוך מילון הטקסטים.

מנגנונית, מידלוור בשם `src/quest.js` נרשם בשרת **לפני** ה-routers של ה-API. הוא לא בודק כלום בזמן קבלת הבקשה, אלא נרשם עם הספרייה `on-headers` להיקרא ממש לפני שהתשובה נשלחת בפועל ללקוח, אחרי שה-route handler הרלוונטי כבר רץ במלואו וקבע Status Code. כלומר הערכת השלב (`pass`/`fail`) מתבצעת **אחרי** שהבקשה כבר טופלה כרגיל על ידי ה-API, ולכן ה-Status Code האמיתי הוא חלק מהשיקול: שלב יכול לדרוש דווקא Status 400 או 404 כתשובה נכונה (למשל שלב שגיאה), וזה נבדק מול מה שקרה בפועל ולא מול הנחה מוקדמת.

כשהשלב עובר, הלקוח שומר את ההתקדמות ב-`localStorage`, פותח את השלב הבא ומציג את הכפתור **לשלב הבא**, הכול בלי ניווט לעמוד חדש: כל 11 השלבים חיים על אותו עמוד יחיד (`/`), ורק תוכן ה-DOM מתחלף.

## השלבים

| # | רעיון | הבקשה הנדרשת | Status צפוי |
|---|---|---|---|
| 1 | בקשת GET ראשונה | `GET /api/movies` | 200 |
| 2 | Route Parameter | `GET /api/movies/:id` על מזהה קיים | 200 |
| 3 | Query Parameter ראשון | `GET /api/movies?genre=<ז'אנר תקין>` | 200 |
| 4 | כמה Query Parameters יחד (סינון + מיון + הגבלה) | `GET /api/movies?minYear=...&sort=...&limit=...` | 200 |
| 5 | יצירת משאב עם POST | `POST /api/movies` עם body תקין (כל השדות הנדרשים) | 201 |
| 6 | שלב שגיאה: בקשה לא תקינה | `POST /api/movies` עם body שמפר את הסכימה בכוונה | 400 |
| 7 | עדכון חלקי עם PATCH | `PATCH /api/movies/:id` עם body חלקי (שדה אחד או יותר) | 200 |
| 8 | החלפה מלאה עם PUT | `PUT /api/movies/:id` עם body מלא (כל השדות הנדרשים) | 200 |
| 9 | משאב מקושר + Query Parameter | `GET /api/directors/:id/movies?sort=...` | 200 |
| 10 | מחיקה עם DELETE | `DELETE /api/movies/:id` על מזהה קיים | 204 |
| 11 | שלב שגיאה: המשאב כבר לא קיים | `GET /api/movies/:id` על המזהה שנמחק בשלב 10 | 404 |

כל שלב בודק פעולה שונה במהותה (method+path+shape שונים), כך שאין שני שלבים שחוזרים על אותה פעולה עם ערכים שונים בלבד. שלבים 4, 7 ו-9 משלבים כמה מושגים יחד באותו שלב: שלב 4 משלב שלושה query parameters (סינון, מיון, הגבלת כמות) על אותו נתיב; שלב 7 משלב route parameter עם body חלקי ועם סמנטיקת PATCH; שלב 9 משלב נתיב מקונן (nested resource, movies שתחת director) עם query parameter. שלבים 6 ו-11 הם שני שלבי שגיאה נפרדים (400 ו-404 בהתאמה), מעבר לדרישת המינימום של שלב שגיאה אחד.

הבדיקה של כל שלב מוגדרת ב-`src/levels.js`: לכל שלב יש פונקציית `check` שמרכיבה כמה תנאים קטנים (method נכון, path תואם, query נדרש קיים ותקין, body עומד בסכימה) בעזרת פונקציית עזר `compose`. אם תנאי נכשל, מוחזר קוד רמז; אם כל התנאים עברו, ה-`X-Quest-Result` נקבע לפי השוואת ה-Status בפועל מול ה-Status הצפוי של השלב.

## ה-API

כל נקודות הקצה חיות תחת `/api/`. תשובות שגיאה כלליות הן `{ "error": "<הודעה>" }`; תשובות שגיאת ולידציה (400 על body או query לא תקינים) מוסיפות גם `details`: מערך אובייקטים בצורה `{ field, code, message }`, אחד לכל בעיה שנמצאה.

| Method | Path | Statuses | תיאור |
|---|---|---|---|
| GET | `/api/movies` | 200, 400 | רשימת סרטים, תומך בכל פרמטרי ה-Query של movies |
| GET | `/api/movies/:id` | 200, 404 | סרט בודד לפי מזהה |
| POST | `/api/movies` | 201, 400 | יצירת סרט, מחזיר את הסרט החדש וכותרת `Location` |
| PUT | `/api/movies/:id` | 200, 400, 404 | החלפה מלאה, כל השדות הנדרשים חייבים להופיע |
| PATCH | `/api/movies/:id` | 200, 400, 404 | עדכון חלקי, רק השדות שנשלחו משתנים |
| DELETE | `/api/movies/:id` | 204, 404 | מחיקה, מחזיר 204 ללא גוף |
| GET | `/api/directors` | 200, 400 | רשימת במאים, תומך בפרמטרי ה-Query של directors |
| GET | `/api/directors/:id` | 200, 404 | במאי בודד לפי מזהה |
| GET | `/api/directors/:id/movies` | 200, 400, 404 | כל הסרטים של במאי, תומך בפרמטרי ה-Query של movies |
| POST | `/api/directors` | 201, 400 | יצירת במאי |
| PUT | `/api/directors/:id` | 200, 400, 404 | החלפה מלאה של במאי |
| PATCH | `/api/directors/:id` | 200, 400, 404 | עדכון חלקי של במאי |
| DELETE | `/api/directors/:id` | 204, 404, 409 | מחיקה, במאי שיש לו סרטים לא נמחק ומחזיר 409 |

### פרמטרי Query של `/api/movies`

| שם | טיפוס | תיאור |
|---|---|---|
| `genre` | enum | רק סרטים מהז'אנר הזה (drama, comedy, sci-fi, thriller, animation, action, horror, documentary) |
| `directorId` | integer | רק סרטים של הבמאי הזה |
| `minYear` | integer | סרטים משנה זו והלאה |
| `maxYear` | integer | סרטים עד שנה זו, כולל |
| `minRating` | number | סרטים עם דירוג זה ומעלה |
| `q` | string | חיפוש טקסט חופשי בשם הסרט, לא תלוי רישיות |
| `sort` | enum | שדה מיון: `year`, `-year`, `rating`, `-rating`, `title`, `-title` (קידומת מינוס = יורד) |
| `limit` | integer | מספר תוצאות מרבי, מופעל אחרי סינון ומיון |

### פרמטרי Query של `/api/directors`

| שם | טיפוס | תיאור |
|---|---|---|
| `country` | string | רק במאים מהמדינה הזו |
| `q` | string | חיפוש טקסט חופשי בשם, לא תלוי רישיות |
| `sort` | enum | שדה מיון: `name`, `-name`, `born`, `-born` |
| `limit` | integer | מספר תוצאות מרבי |

שני המשאבים קשורים דרך `directorId` על כל movie, שמפנה למזהה director קיים (נבדק בזמן POST/PUT/PATCH). המזהים בשני המאגרים עולים בצורה מונוטונית (`nextId` שרק גדל): מזהה שנמחק אף פעם לא מוקצה מחדש, ולכן בקשת GET על מזהה שנמחק ממשיכה להחזיר 404 לצמיתות, גם אחרי שנוצרו משאבים חדשים.

## מבנה הפרויקט

```
server.js                    הקמת אפליקציית Express, הרכבת ה-middleware והנתיבים, טיפול שגיאות מרכזי
src/
  schemas.js                 מקור האמת: שדות ופרמטרי Query של movies ו-directors, וקטלוג נקודות הקצה
  validate.js                ולידציה גנרית של body מול סכימה, ושל query string מול רשימת פרמטרים
  levels.js                  הגדרת 11 השלבים: method, path pattern, Status צפוי, ותנאי הצלחה מורכב
  quest.js                   middleware שרץ אחרי כל route ושופט את הבקשה מול השלב שצוין ב-X-Quest-Level
  data/
    seed.js                  נתוני ההתחלה: שבעה במאים ו-14 סרטים, לפחות סרט אחד לכל ז׳אנר מותר
    store.js                 מאגר בזיכרון בלבד, עם מזהים מונוטוניים ו-reset לבדיקות
  routes/
    api.movies.js            נתיבי REST למשאב movies: GET/POST/PUT/PATCH/DELETE וסינון-מיון-הגבלה
    api.directors.js         נתיבי REST למשאב directors, כולל הנתיב המקונן directors/:id/movies
    pages.js                 נתיבי ה-HTML: / (המשחק) ו-/schemas/, ובחירת שפה מ-cookie/query
  i18n/
    he.json, en.json         כל טקסטי הממשק: ניווט, בונה הבקשה, רמזי שגיאה, וכותרות/משימות השלבים
views/
  game.ejs                   עמוד המשחק, מרונדר בצד השרת עבור השלב הראשון בלבד
  schemas.ejs                עמוד הסכימות, מרונדר במלואו מ-src/schemas.js
  partials/                  head, header, footer משותפים לשני העמודים
public/
  js/game.js                 כל לוגיקת הלקוח: בניית בקשה, שליחה עם fetch, הצגת תשובה ופסיקה, שמירת התקדמות
  js/theme.js                החלפת ערכת נושא בהיר/כהה, נטענת מוקדם כדי למנוע הבהוב
  css/style.css              כל העיצוב, כולל שאילתות מדיה לרספונסיביות
test/
  api.test.js                בדיקות ל-REST API עצמו
  levels.test.js             בדיקות למנגנון שיפוט השלבים
```

## עמידה בדרישות המטלה

| דרישה | איפה במימוש |
|---|---|
| 8 שלבים לפחות | 11 שלבים ב-`src/levels.js` ו-`src/i18n/he.json` (מעל למינימום, כבונוס) |
| כל שלב מציג משימה ברורה | `t.level.concept` ו-`t.level.task` בכל שלב, מוצגים ב-`views/game.ejs` ומתעדכנים ב-`public/js/game.js` |
| בחירת method, path, route params, query params, body ושליחה | בונה הבקשה ב-`views/game.ejs` (`#builder`) ולוגיקת האיסוף ב-`public/js/game.js` |
| הצגת תשובת השרת כולל Status Code | `renderResponse()` ב-`public/js/game.js`, מציג Status, כותרות נבחרות וגוף |
| שיפוט בצד השרת בלבד, לפי מזהה שלב שנשלח בכל בקשה | `src/quest.js` קורא את `X-Quest-Level` ומריץ את `check` של `src/levels.js` |
| הצלחה מתקדמת, כישלון מציג שגיאה ומאפשר ניסיון חוזר | `renderVerdict()`, `markPassed()` ב-`public/js/game.js`; הרמזים ב-`hints` ב-`he.json`/`en.json` |
| תצוגת "שלב X מתוך N" | `t.level.of` מוצג ב-`#level-of`, מחושב מ-`viewing`/`TOTAL` |
| מעבר בין שלבים בלי ניווט לעמוד חדש | `setLevel()` מחליף DOM על אותו עמוד, בלי `location.href` |
| כיסוי GET, POST, PUT/PATCH, DELETE | שלבים 1-4/9/11 (GET), 5-6 (POST), 8 (PUT), 7 (PATCH), 10 (DELETE) |
| route parameters | שלבים 2, 7, 8, 9, 10, 11 (`:id`) |
| query parameters, כולל שלב עם 2+ פרמטרים המשנים תוצאה (סינון/חיפוש/מיון) | שלב 3 (פרמטר יחיד), שלב 4 (minYear + sort + limit יחד), שלב 9 (sort על נתיב מקונן) |
| request body | שלבים 5, 6, 7, 8 |
| תשובות JSON | כל נקודות הקצה מחזירות `res.json(...)`, ראו `src/routes/api.*.js` |
| קודי Status נכונים | טבלת `endpoints` ב-`src/schemas.js`, ונבדק ב-`test/api.test.js` ו-`test/levels.test.js` |
| שלב שגיאה אחד לפחות (למשל 404) | שלב 6 (400) ושלב 11 (404), שניהם |
| 3 שלבים לפחות שמשלבים כמה מושגים | שלבים 4, 7, 9 (ראו הסבר בטבלת השלבים למעלה) |
| בלי חזרה על אותה פעולה עם ערכים שונים | כל שלב ב-`src/levels.js` בודק method+path+shape שונים |
| שרת Node.js + Express | `server.js`, תלות ב-`express` ב-`package.json` |
| שני משאבים לפחות עם קשר ביניהם | movies ו-directors, קשורים דרך `directorId` (`src/schemas.js`) |
| נתיבים לכל פעולה | `src/routes/api.movies.js`, `src/routes/api.directors.js` |
| נתונים בזיכרון בלבד, נשמרים לאורך ריצה | `src/data/store.js`, בלי חיבור לבסיס נתונים |
| נתיבים בסגנון REST (שמות עצם + methods, לא `/deleteBook`) | `/api/movies`, `/api/directors` בלבד, ראו טבלת ה-API |
| בקשות דרך AJAX (fetch) בלי רענון עמוד | `fetch(url, options)` ב-`send()` ב-`public/js/game.js` |
| עמוד משחק ראשי ב-EJS | `views/game.ejs`, מרונדר על ידי `src/routes/pages.js` |
| עמוד סכימות בצד השרת שמפרט שדות/טיפוסים לכל משאב | `views/schemas.ejs`, מרונדר מ-`src/schemas.js`, נגיש ב-`/schemas/` |
| API תחת `/api/`, משחק ב-`/`, סכימות ב-`/schemas/` | `server.js` (`app.use('/api', ...)`) ו-`src/routes/pages.js` |
| JavaScript וניל בלבד בצד לקוח | `public/js/game.js`, `public/js/theme.js`, בלי ספריות או פריימוורק |
| שיטות וקודי Status נכונים | ראו טבלת ה-API למעלה |
| הפרדה ברורה בין לקוח לשרת | הלקוח בונה ושולח בקשות בלבד; כל הוולידציה וההחלטות ב-`src/`, ללא לוגיקת עסק בקבצי הלקוח |
| רספונסיביות | שאילתות מדיה ב-`public/css/style.css` (900px, 560px, 420px) |
| CSS וקוד לקוח בקבצים חיצוניים | `public/css/style.css`, `public/js/game.js`, `public/js/theme.js`, מוגשים כ-`express.static` |
| **בונוס:** שלבים נוספים מעבר למינימום | 11 שלבים במקום 8 |
| **בונוס:** ספירת ניסיונות והתקדמות שמורה | `state.attempts`, `state.done` ב-`localStorage` (`public/js/game.js`) |
| **בונוס:** אפשרות לשחק שוב שלבים שהושלמו | לחיצה על צ'יפ שהושלם ב-`#level-map` פותחת אותו מחדש |
| **בונוס:** איפוס התקדמות | כפתור **איפוס** עם אישור, `resetProgress()` |
| **בונוס:** תצוגה חיה של שורת הבקשה לפני שליחה | `renderRequestLine()`, מתעדכן בכל הקלדה |
| **בונוס:** בדיקת תחביר JSON בצד הלקוח, כחוויית משתמש בלבד | ב-`send()`, לא משפיעה על מה שנשלח בפועל לשרת |
| **בונוס:** ערכת נושא בהיר/כהה | `public/js/theme.js` |
| **בונוס:** ממשק דו-לשוני מלא, כולל טקסטי השלבים | `src/i18n/he.json`, `src/i18n/en.json`, בחירה דרך `?lang=` וקוקי |
| **בונוס:** 77 בדיקות אוטומטיות | `test/api.test.js` (41) ו-`test/levels.test.js` (36), ראו סעיף הבדיקות |

## בדיקות

חבילת הבדיקות מבוססת על `node:test` המובנה, בלי ספריית בדיקות חיצונית, ומריצה שרת אמיתי על פורט אקראי לכל הרצה.

`test/api.test.js` בודק את ה-API עצמו, בלי קשר למנגנון השלבים: רשימה וסינון (genre, directorId, minYear/maxYear, minRating, q), מיון בשני הכיוונים על שדות שונים, limit, יצירה תקינה ולא תקינה (שדה חסר, שדה לא מוכר, id ב-body, directorId שלא קיים), PUT/PATCH/DELETE על movies ו-directors, מחיקת במאי עם סרטים (409), 404 על מזהים לא קיימים או לא מספריים, JSON פגום (400), ואיפוס המאגר בין בדיקות.

`test/levels.test.js` בודק את מנגנון השיפוט עצמו: על כל אחד מ-11 השלבים נבדק תרחיש הצלחה אחד ומספר תרחישי כישלון, כולל קוד הרמז המדויק שחוזר בכותרת `X-Quest-Hint` (`wrong-method`, `wrong-path`, `missing-query:<param>`, `bad-query:<param>`, `body-missing`, `body-invalid:<field>`, `id-not-found`, `still-exists`, `body-was-valid`, `wrong-status:<expected>`, `unknown-level`). כן נבדק המקרה שבו לא נשלחה כותרת `X-Quest-Level` כלל, ושמזהה שלב לא קיים מחזיר `unknown-level`.

להרצת כל הבדיקות:

```bash
npm test
```

ריצה מלאה עומדת על 77 בדיקות, כולן עוברות.

## English summary

HTTP Quest is a browser game for learning HTTP and REST, built around a movies/directors dataset. It has 11 levels, each showing a concept and a task, where the player builds a real HTTP request (method, path, route params, query params, body) and sends it with `fetch`. Correctness is judged entirely server-side: every request carries an `X-Quest-Level` header, and the server responds with `X-Quest-Result: pass|fail` and, on failure, `X-Quest-Hint: <code>`. Judging happens in an `on-headers` callback after the route already ran, so the real status code is part of the verdict, and the API response body itself stays untouched, identical to what `curl` would get. The stack is Node.js, Express 5 and EJS for server-rendered pages (the game at `/` and a schema reference at `/schemas/`), with the API under `/api/`, in-memory storage only, and vanilla JavaScript on the client (no framework). The UI is fully bilingual (Hebrew and English), including level text, and includes bonus features: progress and attempt tracking in `localStorage`, replaying completed levels, a live request-line preview, a light/dark theme, and 77 automated tests (`npm test`) covering both the REST API and the level-judging mechanism.
