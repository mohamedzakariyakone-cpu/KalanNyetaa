-- Tables pour l'application de gestion scolaire

-- Table des classes
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  level VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des élèves
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  class_id INTEGER REFERENCES classes(id),
  annual_fee DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des professeurs
CREATE TABLE teachers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  subject VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des paiements
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des matières par classe
CREATE TABLE class_subjects (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id),
  subject_name VARCHAR(100) NOT NULL,
  coefficient INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des notes des élèves
CREATE TABLE student_grades (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  class_id INTEGER REFERENCES classes(id),
  subject_name VARCHAR(100) NOT NULL,
  period VARCHAR(50) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  grade_value DECIMAL(5,2),
  compo_value DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, subject_name, period, academic_year)
);