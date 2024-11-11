// استيراد المكتبات اللازمة
const puppeteer = require("puppeteer"); // مكتبة Puppeteer لأتمتة المتصفح
const express = require("express"); // مكتبة Express لإنشاء سيرفر ويب
const mongoose = require("mongoose"); // مكتبة Mongoose للتعامل مع قاعدة بيانات MongoDB
const cors = require("cors"); // مكتبة CORS لتمكين سياسة تبادل الموارد بين المصادر المختلفة

// تهيئة تطبيق Express وتحديد منفذ التشغيل
const app = express();
const port = process.env.PORT || 3000; // المنفذ الافتراضي 3000 أو المعرّف في متغيرات البيئة

// تفعيل سياسة CORS للسماح بالطلبات من مصادر محددة فقط
app.use(cors({
  origin: ['https://app.inno-acc.com', 'chrome-extension://imhiiignfblghjjhpjfpgedinddaobjf']
}));

// الاتصال بقاعدة بيانات MongoDB Atlas
mongoose.connect('mongodb+srv://<username>:<password>@cluster0.oth1w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB Atlas'); // تأكيد نجاح الاتصال
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error); // طباعة رسالة خطأ في حالة فشل الاتصال
});

// تعريف نموذج الجلسة (Session) لتخزين بيانات الجلسات
const sessionSchema = new mongoose.Schema({
  name: String,
  value: String,
  domain: String,
  path: String,
  expires: Number,
  httpOnly: Boolean,
  secure: Boolean,
});

// إنشاء نموذج للبيانات باستخدام Mongoose
const Session = mongoose.model('Session', sessionSchema);

/**
 * دالة لاستخراج توكين الجلسة عبر Puppeteer وتخزينه في قاعدة البيانات
 * @param {Object} res - استجابة HTTP لإرجاع نتيجة العملية
 */
async function extractSessionToken(res) {
  try {
    // إطلاق متصفح Puppeteer في وضع headless بدون واجهة
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ]
    });

    const page = await browser.newPage(); // فتح صفحة جديدة في المتصفح

    // الذهاب إلى صفحة تسجيل الدخول لموقع CreativeSea
    await page.goto("https://creativsea.com/my-account/", {
      waitUntil: "networkidle2",
      timeout: 120000, // تحديد مهلة الانتظار بـ 120 ثانية
    });

    // إدخال اسم المستخدم وكلمة المرور لتسجيل الدخول
    await page.type("#username", "danielwidmer55477@gmail.com");
    await page.type("#password", "rankerfox.com#345");

    // النقر على زر تسجيل الدخول
    await page.click('button[name="login"]');

    // الانتظار حتى يتم التوجيه بعد تسجيل الدخول
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });

    // استخراج بيانات الكوكيز بعد تسجيل الدخول
    const cookies = await page.cookies();

    // حذف الجلسات القديمة من قاعدة البيانات
    await Session.deleteMany({});
    console.log("Old sessions deleted.");

    // البحث عن توكين الجلسة ضمن الكوكيز
    const sessionToken = cookies.find(
      (cookie) => cookie.name === "wordpress_logged_in_69f5389998994e48cb1f2b3bcad30e49"
    );

    // إذا تم العثور على التوكين، نقوم بتخزينه في قاعدة البيانات
    if (sessionToken) {
      const sessionData = new Session({
        name: sessionToken.name,
        value: sessionToken.value,
        domain: sessionToken.domain,
        path: sessionToken.path,
        expires: sessionToken.expires,
        httpOnly: sessionToken.httpOnly,
        secure: sessionToken.secure,
      });

      await sessionData.save(); // حفظ التوكين في قاعدة البيانات
      console.log("Session token saved to MongoDB Atlas successfully.");

      // إرسال التوكين كاستجابة لـ API
      res.json({ success: true, token: sessionData });
    } else {
      console.log("لم يتم العثور على توكين الجلسة.");
      res.json({ success: false, message: "لم يتم العثور على توكين الجلسة." });
    }

    // إغلاق المتصفح بعد إتمام العملية
    await browser.close();
  } catch (error) {
    console.error("حدث خطأ:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء استخراج التوكين." });
  }
}

// تعريف نقطة النهاية لجلب أحدث بيانات الجلسة المخزنة في قاعدة البيانات
app.get("/get-session", async (req, res) => {
  try {
    // استرجاع أحدث جلسة من قاعدة البيانات بناءً على ترتيب ID
    const sessionData = await Session.findOne().sort({ _id: -1 });

    if (sessionData) {
      res.json({ success: true, session: sessionData }); // إذا وجدت جلسة، إرجاع البيانات
    } else {
      res.json({ success: false, message: "No session data found." }); // في حال عدم وجود جلسات
    }
  } catch (error) {
    console.error("Error retrieving session data:", error);
    res.status(500).json({ success: false, message: "Error retrieving session data." });
  }
});

// تعريف نقطة النهاية لبدء جلسة جديدة واستخراج التوكين
app.get("/start-session", (req, res) => {
  extractSessionToken(res); // استدعاء دالة استخراج التوكين
});

// بدء تشغيل السيرفر على المنفذ المحدد
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
