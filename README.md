
# 🎓 Student Track Recorder

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-lightgrey.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A user-friendly web application built with Flask to help educational institutions manage student records, track attendance, assign activities, handle certificates, and facilitate communication. Supports multiple user roles for seamless administration.

## 📋 Table of Contents
- [✨ Features](#-features)
- [🚀 Installation](#-installation)
- [📖 Usage](#-usage)
- [🛠️ Technologies Used](#%EF%B8%8F-technologies-used)
- [📁 Project Structure](#-project-structure)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🆘 Support](#-support)

## ✨ Features

### 👥 User Management
- 🔐 **Multi-role Authentication**: Separate logins for faculty, secondary admins, and students
- 🛡️ **Secure Access**: Role-based permissions with session management
- 👤 **Profile Management**: Personal profiles with photos and contact info

### 🏫 Academic Structure Management
- 📚 **Organized Hierarchy**: Easily manage courses, academic years, and sections
- 🎓 **Student Records**: Complete student profiles with photos and details
- 👨‍🏫 **Admin Assignment**: Assign faculty to specific sections and subjects

### 📊 Attendance Tracking
- 📝 **Subject-wise Tracking**: Detailed attendance records per subject
- 📅 **Flexible Recording**: Track present/absent counts by date
- ❓ **Issue Reporting**: Students can report attendance problems
- 🔒 **Controlled Access**: Admins only manage their assigned subjects

### 🎯 Activity Management
- 📋 **Activity Assignment**: Create and assign tasks to students
- 📈 **Progress Monitoring**: Track participation and add remarks

### 🏆 Certificate Management
- 📄 **Easy Upload**: Teachers can upload student certificates
- 👀 **Student View**: Students can access their certificates
- 💾 **Secure Storage**: Safe file handling with automatic cleanup

### 🔍 Scrutiny System
- 📑 **Document Submission**: Students submit documents for verification
- 📊 **Status Updates**: Track submission progress (pending, accepted, etc.)
- ✅ **Faculty Review**: Teachers can review and comment on submissions

### 💬 Communication Features
- 👥 **Group Chats**: Section-wide group discussions
- 💌 **Private Messages**: Direct teacher-student communication
- 📎 **File Sharing**: Share attachments in messages
- ⚙️ **Permission Settings**: Customize who can chat (all, teachers, custom)

### 📚 Notes and Resources
- 📖 **Organized Notes**: Upload and categorize notes by subject
- 📤 **Resource Sharing**: Share study materials with students
- 🔐 **Access Control**: Students see only relevant materials

## 🚀 Installation

### Prerequisites
- 🐍 Python 3.7 or higher
- 📦 pip (Python package manager)

### Quick Setup
1. **Clone the repo** 📥
   ```bash
   git clone https://github.com/your-username/student-track-recorder.git
   cd student-track-recorder
   ```

2. **Install dependencies** ⚙️
   ```bash
   pip install flask werkzeug
   ```

3. **Start the app** ▶️
   ```bash
   python app.py
   ```

4. **Open in browser** 🌐
   Visit `http://localhost:5000`

### Default Login Credentials
- **Main Faculty**: Username: `faculty`, Password: `1`
- **Secondary Admin**: Username: `secondary`, Password: `1`

## 📖 Usage

### For Faculty/Main Administrators 👨‍🏫
1. Log in with faculty credentials
2. Set up courses, years, and sections
3. Add student profiles and photos
4. Assign secondary admins to sections
5. Monitor attendance and upload certificates
6. Review student submissions and manage chats

### For Secondary Administrators 👩‍🏫
1. Log in with assigned credentials
2. Work within your assigned sections and subjects
3. Mark attendance for your subjects
4. Upload notes and study materials
5. Participate in group and private chats

### For Students 🎓
1. Log in with your credentials
2. View your profile and assigned activities
3. Check your attendance records
4. Access your certificates and notes
5. Submit documents for verification
6. Chat with teachers and classmates

## 🛠️ Technologies Used

- **Backend**: Flask (Python web framework) 🐍
- **Frontend**: HTML5, CSS3, JavaScript 🌐
- **Data Storage**: JSON files for simple persistence 💾
- **File Handling**: Werkzeug for secure uploads 📁
- **Authentication**: Session-based with role management 🔐
- **Security**: Password hashing and file validation 🛡️

## 📁 Project Structure

```
student-track-recorder/
├── app.py                 # Main Flask application 🚀
├── templates/             # HTML templates 📄
├── static/                # Static files (CSS, JS, images) 🎨
│   └── uploads/          # Uploaded files storage 📎
├── data/                  # JSON data storage 💾
└── README.md             # Project documentation 📖
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository 🍴
2. Create a feature branch (`git checkout -b feature/AmazingFeature`) 🌿
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`) 💾
4. Push to the branch (`git push origin feature/AmazingFeature`) 📤
5. Open a Pull Request 🔄

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

Need help? Open an issue on GitHub or contact the maintainers.

