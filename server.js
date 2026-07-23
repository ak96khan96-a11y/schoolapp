const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🚀 Database Tables Creation (With Data Isolation)
// ==========================================
const createTables = async () => {
  try {
    // 1. Schools Table (With Subscription Columns)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        school_name VARCHAR(255) NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        address TEXT NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        plan_name VARCHAR(50) DEFAULT 'Free',
        plan_status VARCHAR(20) DEFAULT 'Active',
        plan_expiry DATE
      );
    `);

    // 🚀 SMART UPDATER: Agar purani schools table hai, toh usme subscription ke column add kar dega bina data delete kiye
    try {
      await pool.query(`ALTER TABLE schools ADD COLUMN plan_name VARCHAR(50) DEFAULT 'Free'`);
      await pool.query(`ALTER TABLE schools ADD COLUMN plan_status VARCHAR(20) DEFAULT 'Active'`);
      await pool.query(`ALTER TABLE schools ADD COLUMN plan_expiry DATE`);
    } catch (e) {
      // Agar columns pehle se hain, toh yeh error ko ignore kar dega (Safe mode)
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        student_name VARCHAR(100) NOT NULL,
        class VARCHAR(20) NOT NULL,
        roll_no VARCHAR(20) NOT NULL,
        parent_phone VARCHAR(15) NOT NULL,
        yearly_fee INTEGER NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        class_id VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(5) NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fees (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        payment_date DATE NOT NULL
      );
    `);

    // ==========================================
    // 🚀 NAYI STAFF TABLES 
    // ==========================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        role VARCHAR(100),
        monthly_salary NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_attendance (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(10) NOT NULL, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(staff_id, date) 
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_salary (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ All Database Tables Ready (Staff & Subscriptions Active!)");
  } catch (err) {
    console.error("❌ Error creating tables:", err.message);
  }
};

createTables();

// ==========================================
// API Routes
// ==========================================

// 1. Register School
app.post('/register-school', async (req, res) => {
  try {
    const { school_name, mobile, address, email } = req.body;
    const existing = await pool.query("SELECT * FROM schools WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Ye email pehle se registered hai!' });
    }
    const newSchool = await pool.query(
      `INSERT INTO schools (school_name, mobile, address, email) VALUES ($1, $2, $3, $4) RETURNING *`,
      [school_name, mobile, address, email]
    );
    res.status(201).json({ success: true, data: newSchool.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// 2. Login School
app.post('/login-school', async (req, res) => {
  try {
    const { email } = req.body;
    const school = await pool.query("SELECT * FROM schools WHERE email = $1", [email]);
    if (school.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'School database me nahi mila!' });
    }
    res.json({ success: true, data: school.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// 🚀 2.5 Update Subscription (Naya API)
app.post('/update-subscription', async (req, res) => {
  try {
    const { school_id, plan_name, plan_status, plan_expiry } = req.body;
    await pool.query(
      "UPDATE schools SET plan_name = $1, plan_status = $2, plan_expiry = $3 WHERE id = $4",
      [plan_name, plan_status, plan_expiry, school_id]
    );
    res.json({ success: true, message: 'Subscription successfully updated!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error updating subscription' });
  }
});

// 3. Add Student
app.post('/add-student', async (req, res) => {
  try {
    const { school_id, name, class: studentClass, roll_no, parent_phone, yearly_fee } = req.body;
    const newStudent = await pool.query(
      `INSERT INTO students (school_id, student_name, class, roll_no, parent_phone, yearly_fee) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [school_id, name, studentClass, roll_no, parent_phone, yearly_fee]
    );
    res.status(201).json({ success: true, data: newStudent.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// 4. Get Students
app.get('/students/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const { school_id } = req.query; 
    const studentsData = await pool.query(
      "SELECT * FROM students WHERE class = $1 AND school_id = $2 ORDER BY student_name ASC",
      [classId, school_id]
    );
    res.json({ success: true, data: studentsData.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 5. Pay Fee
app.post('/pay-fee', async (req, res) => {
  try {
    const { school_id, student_id, amount, date } = req.body;
    await pool.query(
      "INSERT INTO fees (school_id, student_id, amount, payment_date) VALUES ($1, $2, $3, $4)",
      [school_id, student_id, amount, date]
    );
    res.json({ success: true, message: 'Fee paid successfully!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 6. Check Today's Attendance Lock
app.get('/check-attendance/:classId/:date', async (req, res) => {
  try {
    const { classId, date } = req.params;
    const { school_id } = req.query;
    const records = await pool.query(
      "SELECT * FROM attendance WHERE class_id = $1 AND date = $2 AND school_id = $3",
      [classId, date, school_id]
    );
    res.json({ success: true, submitted: records.rows.length > 0, data: records.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 7. Save Attendance
app.post('/save-attendance', async (req, res) => {
  try {
    const { school_id, classId, date, attendanceData } = req.body;
    for (const studentId in attendanceData) {
      const status = attendanceData[studentId];
      const checkResult = await pool.query(
        "SELECT * FROM attendance WHERE student_id = $1 AND date = $2 AND school_id = $3",
        [studentId, date, school_id]
      );
      if (checkResult.rows.length > 0) {
        await pool.query(
          "UPDATE attendance SET status = $1 WHERE student_id = $2 AND date = $3 AND school_id = $4",
          [status, studentId, date, school_id]
        );
      } else {
        await pool.query(
          "INSERT INTO attendance (school_id, student_id, class_id, date, status) VALUES ($1, $2, $3, $4, $5)",
          [school_id, studentId, classId, date, status]
        );
      }
    }
    res.json({ success: true, message: 'Attendance Saved!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 8. Get Single Student Attendance
app.get('/attendance/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const records = await pool.query(
      "SELECT date, status FROM attendance WHERE student_id = $1",
      [studentId]
    );
    res.json({ success: true, data: records.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// 🚀 NAYE STAFF API ROUTES
// ==========================================

// 9. Add Staff
app.post('/add-staff', async (req, res) => {
  try {
    const { school_id, name, mobile, role, monthly_salary } = req.body;
    const newStaff = await pool.query(
      `INSERT INTO staff (school_id, name, mobile, role, monthly_salary) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [school_id, name, mobile, role, monthly_salary]
    );
    res.status(201).json({ success: true, data: newStaff.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 10. Get Staff List
app.get('/staff', async (req, res) => {
  try {
    const { school_id } = req.query;
    const staffList = await pool.query(
      "SELECT * FROM staff WHERE school_id = $1 ORDER BY name ASC",
      [school_id]
    );
    res.json({ success: true, data: staffList.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 11. Save Staff Attendance
app.post('/mark-staff-attendance', async (req, res) => {
  try {
    const { school_id, date, records } = req.body;
    for (const staffId in records) {
      const status = records[staffId];
      const checkResult = await pool.query(
        "SELECT * FROM staff_attendance WHERE staff_id = $1 AND date = $2 AND school_id = $3",
        [staffId, date, school_id]
      );
      if (checkResult.rows.length > 0) {
        await pool.query(
          "UPDATE staff_attendance SET status = $1 WHERE staff_id = $2 AND date = $3 AND school_id = $4",
          [status, staffId, date, school_id]
        );
      } else {
        await pool.query(
          "INSERT INTO staff_attendance (school_id, staff_id, date, status) VALUES ($1, $2, $3, $4)",
          [school_id, staffId, date, status]
        );
      }
    }
    res.json({ success: true, message: 'Staff Attendance Saved!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 12. Pay Staff Salary
app.post('/pay-staff-salary', async (req, res) => {
  try {
    const { school_id, staff_id, amount, date } = req.body;
    await pool.query(
      "INSERT INTO staff_salary (school_id, staff_id, amount, date) VALUES ($1, $2, $3, $4)",
      [school_id, staff_id, amount, date]
    );
    res.json({ success: true, message: 'Staff Salary paid successfully!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// Server Start
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend run successful port ${PORT} par! 🚀`);
});
