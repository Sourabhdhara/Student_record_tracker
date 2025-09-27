import os
import json
import uuid
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Change this in production

# Base data directory
DATA_DIR = "data"
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Ensure directories exist
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Role helpers

def is_admin():
    return session.get('user_type') in {'faculty', 'secondary'}

def is_main_admin():
    return session.get('user_type') == 'faculty'

# Helper functions for data management

def get_courses():
    courses = []
    if os.path.exists(DATA_DIR):
        for item in os.listdir(DATA_DIR):
            if os.path.isdir(os.path.join(DATA_DIR, item)):
                courses.append(item)
    return courses


def get_years(course):
    years = []
    course_path = os.path.join(DATA_DIR, course)
    if os.path.exists(course_path):
        for item in os.listdir(course_path):
            if os.path.isdir(os.path.join(course_path, item)):
                years.append(item)
    return years


def get_sections(course, year):
    sections = []
    year_path = os.path.join(DATA_DIR, course, year)
    if os.path.exists(year_path):
        for item in os.listdir(year_path):
            if os.path.isdir(os.path.join(year_path, item)):
                sections.append(item)
    return sections


def get_students(course, year, section):
    students_path = os.path.join(DATA_DIR, course, year, section, "students.json")
    if os.path.exists(students_path):
        try:
            with open(students_path, 'r') as f:
                # Check if file is empty
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading students file: {e}")
            return []
    return []


def get_activities(course, year, section):
    activities_path = os.path.join(DATA_DIR, course, year, section, "activities.json")
    if os.path.exists(activities_path):
        try:
            with open(activities_path, 'r') as f:
                # Check if file is empty
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading activities file: {e}")
            return []
    return []


def save_students(course, year, section, students):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)

    students_path = os.path.join(section_path, "students.json")
    with open(students_path, 'w') as f:
        json.dump(students, f, indent=2)


def save_activities(course, year, section, activities):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)

    activities_path = os.path.join(section_path, "activities.json")
    with open(activities_path, 'w') as f:
        json.dump(activities, f, indent=2)

# Secondary admin (faculty profiles per section)

def get_secondary_admins(course, year, section):
    path = os.path.join(DATA_DIR, course, year, section, 'secondary_admin.json')
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading secondary_admin file: {e}")
            return []
    return []


def save_secondary_admins(course, year, section, data):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    path = os.path.join(section_path, 'secondary_admin.json')
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Attendance helpers

def get_attendance_path(course, year, section):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    return os.path.join(section_path, 'attendance.json')


def load_attendance(course, year, section):
    path = get_attendance_path(course, year, section)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {"subjects": [], "records": {}}
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading attendance file: {e}")
            return {"subjects": [], "records": {}}
    # If file doesn't exist, create default
    data = {"subjects": [], "records": {}}
    save_attendance(course, year, section, data)
    return data


def save_attendance(course, year, section, data):
    path = get_attendance_path(course, year, section)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Attendance records utilities (supports present/absent counts)

def get_att_rec_entry(data, subject, student_id):
    recs = data.setdefault('records', {}).setdefault(subject, {})
    entry = recs.get(student_id)
    # If legacy list format, treat as present dates with count 1
    if entry is None:
        return {'present': {}, 'absent': {}}
    if isinstance(entry, list):
        counts = {}
        for dt in entry:
            day = str(dt)[:10]
            counts[day] = counts.get(day, 0) + 1
        return {'present': counts, 'absent': {}}
    # New format expected
    pr = {str(k): int(v) for k, v in (entry.get('present') or {}).items()}
    ab = {str(k): int(v) for k, v in (entry.get('absent') or {}).items()}
    return {'present': pr, 'absent': ab}


def save_att_rec_entry(data, subject, student_id, entry):
    recs = data.setdefault('records', {}).setdefault(subject, {})
    # Clean zero counts
    pr = {k: int(v) for k, v in (entry.get('present') or {}).items() if int(v) > 0}
    ab = {k: int(v) for k, v in (entry.get('absent') or {}).items() if int(v) > 0}
    recs[student_id] = {'present': pr, 'absent': ab}


def expand_counts(counts):
    out = []
    for d, c in (counts or {}).items():
        try:
            n = int(c)
        except Exception:
            n = 0
        if n > 0:
            out.extend([d] * n)
    return sorted(out)

# Attendance issues helpers


def get_attendance_issue_path(course, year, section):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    return os.path.join(section_path, 'Attendance_issue.json')


def load_attendance_issues(course, year, section):
    path = get_attendance_issue_path(course, year, section)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {"issues": []}
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading attendance issues file: {e}")
            return {"issues": []}
    data = {"issues": []}
    save_attendance_issues(course, year, section, data)
    return data


def save_attendance_issues(course, year, section, data):
    path = get_attendance_issue_path(course, year, section)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Initialize default data structure

def initialize_default_data():
    # Create default course, year, and section if they don't exist
    default_course = "B.Tech"
    default_year = "1st Year"
    default_section = "A Section"

    course_path = os.path.join(DATA_DIR, default_course)
    year_path = os.path.join(course_path, default_year)
    section_path = os.path.join(year_path, default_section)

    if not os.path.exists(section_path):
        os.makedirs(section_path)

        # Create empty students and activities files
        save_students(default_course, default_year, default_section, [])
        save_activities(default_course, default_year, default_section, [])
        # Create attendance file
        save_attendance(default_course, default_year, default_section, {"subjects": [], "records": {}})
        # Create attendance issues file
        save_attendance_issues(default_course, default_year, default_section, {"issues": []})
        # Create secondary_admin file
        save_secondary_admins(default_course, default_year, default_section, [])
        # Create chat storage file
        chat_path = os.path.join(section_path, 'chat.json')
        with open(chat_path, 'w') as f:
            json.dump({"groups": {}, "messages": {}}, f, indent=2)
        # Create certificates storage file
        cert_path = os.path.join(section_path, 'certificates.json')
        with open(cert_path, 'w') as f:
            json.dump({"byStudent": {}}, f, indent=2)
        # Create scrutiny storage file
        scr_path = os.path.join(section_path, 'scrutiny.json')
        with open(scr_path, 'w') as f:
            json.dump({"requests": []}, f, indent=2)

# Call this function when the app starts
initialize_default_data()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# Faculty authentication with two roles
@app.route('/faculty_login', methods=['POST'])
def faculty_login():
    data = request.get_json() or {}
    account_type = (data.get('accountType') or 'main').strip().lower()
    user_id = (data.get('userId') or '').strip()
    password = (data.get('password') or '').strip()

    if account_type == 'main':
        if user_id == 'faculty' and password == '1':
            session['user_type'] = 'faculty'
            session['user_id'] = 'faculty'
            return jsonify({'success': True, 'role': 'faculty'})
        return jsonify({'success': False, 'error': 'Invalid credentials for main admin'})

    # Secondary admin login: allow static default OR match any entry in secondary_admin.json
    if account_type == 'secondary':
        # Default fallback secondary credentials
        if user_id == 'secondary' and password == '1':
            session['user_type'] = 'secondary'
            session['user_id'] = user_id
            return jsonify({'success': True, 'role': 'secondary'})
        # Search in all sections
        for course in get_courses():
            for year in get_years(course):
                for section in get_sections(course, year):
                    try:
                        admins = get_secondary_admins(course, year, section)
                        for admin in admins:
                            if (admin.get('userId') == user_id and admin.get('password') == password):
                                session['user_type'] = 'secondary'
                                session['user_id'] = user_id
                                session['secondary_admin'] = {
                                    'profile': admin,
                                    'course': course,
                                    'year': year,
                                    'section': section
                                }
                                return jsonify({'success': True, 'role': 'secondary'})
                    except Exception:
                        continue
        return jsonify({'success': False, 'error': 'Invalid credentials for secondary admin'})

    return jsonify({'success': False, 'error': 'Unknown account type'})

# Student authentication
@app.route('/student_login', methods=['POST'])
def student_login():
    data = request.get_json()
    roll_number = data.get('rollNumber')
    email = data.get('email')
    password = data.get('password')

    # Search for student in all sections
    for course in get_courses():
        for year in get_years(course):
            for section in get_sections(course, year):
                students = get_students(course, year, section)
                for student in students:
                    if (student['rollNumber'] == roll_number and 
                        student['email'] == email and 
                        student['secretPassword'] == password):
                        session['user_type'] = 'student'
                        session['student_data'] = student
                        session['student_course'] = course
                        session['student_year'] = year
                        session['student_section'] = section
                        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Invalid credentials'})

# Course management
@app.route('/get_courses')
def get_courses_api():
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    courses = get_courses()
    return jsonify(courses)


@app.route('/add_course', methods=['POST'])
def add_course():
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    course_name = data.get('name')

    if not course_name:
        return jsonify({'success': False, 'error': 'Course name is required'})

    course_path = os.path.join(DATA_DIR, course_name)
    if not os.path.exists(course_path):
        os.makedirs(course_path)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Course already exists'})


@app.route('/delete_course/<course_name>')
def delete_course(course_name):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    course_path = os.path.join(DATA_DIR, course_name)
    if os.path.exists(course_path):
        import shutil
        shutil.rmtree(course_path)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Course not found'})


@app.route('/delete_year/<course>/<year_name>')
def delete_year(course, year_name):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    year_path = os.path.join(DATA_DIR, course, year_name)
    if os.path.exists(year_path):
        import shutil
        shutil.rmtree(year_path)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Year not found'})


@app.route('/delete_section/<course>/<year>/<section_name>')
def delete_section(course, year, section_name):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    section_path = os.path.join(DATA_DIR, course, year, section_name)
    if os.path.exists(section_path):
        import shutil
        shutil.rmtree(section_path)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Section not found'})

# Year management
@app.route('/get_years/<course>')
def get_years_api(course):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    years = get_years(course)
    return jsonify(years)


@app.route('/add_year/<course>', methods=['POST'])
def add_year(course):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    year_name = data.get('name')

    if not year_name:
        return jsonify({'success': False, 'error': 'Year name is required'})

    year_path = os.path.join(DATA_DIR, course, year_name)
    if not os.path.exists(year_path):
        os.makedirs(year_path)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Year already exists'})

# Section management
@app.route('/get_sections/<course>/<year>')
def get_sections_api(course, year):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    sections = get_sections(course, year)
    return jsonify(sections)


@app.route('/add_section/<course>/<year>', methods=['POST'])
def add_section(course, year):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    section_name = data.get('name')

    if not section_name:
        return jsonify({'success': False, 'error': 'Section name is required'})

    section_path = os.path.join(DATA_DIR, course, year, section_name)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
        # Create empty students and activities files
        save_students(course, year, section_name, [])
        save_activities(course, year, section_name, [])
        # Create attendance file
        save_attendance(course, year, section_name, {"subjects": [], "records": {}})
        # Create attendance issues file
        save_attendance_issues(course, year, section_name, {"issues": []})
        # Create secondary admins file
        save_secondary_admins(course, year, section_name, [])
        # Create chat storage file
        chat_path = os.path.join(DATA_DIR, course, year, section_name, 'chat.json')
        with open(chat_path, 'w') as f:
            json.dump({"groups": {}, "messages": {}}, f, indent=2)
        # Create certificates storage file
        cert_path = os.path.join(DATA_DIR, course, year, section_name, 'certificates.json')
        with open(cert_path, 'w') as f:
            json.dump({"byStudent": {}}, f, indent=2)
        # Create scrutiny storage file
        scr_path = os.path.join(DATA_DIR, course, year, section_name, 'scrutiny.json')
        with open(scr_path, 'w') as f:
            json.dump({"requests": []}, f, indent=2)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Section already exists'})

# Student management
@app.route('/get_students/<course>/<year>/<section>')
def get_students_api(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        students = get_students(course, year, section)
        return jsonify(students)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/add_student/<course>/<year>/<section>', methods=['POST'])
def add_student(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.form
    students = get_students(course, year, section)

    # Handle file upload
    photo_filename = None
    if 'studentPhoto' in request.files:
        file = request.files['studentPhoto']
        if file and file.filename != '' and allowed_file(file.filename):
            # Generate a unique filename
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            photo_filename = filename

    # Generate a unique ID for the student
    student_id = f"student_{len(students) + 1:03d}"

    from datetime import datetime

    student_data = {
        'id': student_id,
        'name': data.get('name'),
        'rollNumber': data.get('rollNumber'),
        'email': data.get('email'),
        'phone': data.get('phone'),
        'fatherName': data.get('fatherName'),
        'fatherPhone': data.get('fatherPhone'),
        'motherName': data.get('motherName'),
        'motherPhone': data.get('motherPhone'),
        'secretPassword': data.get('secretPassword'),
        'photo': photo_filename,  # Store filename or None
        'assignedActivities': [],
        'createdAt': data.get('createdAt', datetime.now().isoformat())
    }

    students.append(student_data)
    save_students(course, year, section, students)

    return jsonify({'success': True, 'studentId': student_id})

# Delete student
@app.route('/delete_student/<course>/<year>/<section>/<student_id>', methods=['DELETE'])
def delete_student(course, year, section, student_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    students = get_students(course, year, section)

    # Find the student to be deleted and delete their photo if it exists
    student_to_delete = None
    for student in students:
        if student['id'] == student_id:
            student_to_delete = student
            break

    if not student_to_delete:
        return jsonify({'success': False, 'error': 'Student not found'})

    # Delete the profile picture file if it exists
    if student_to_delete.get('photo'):
        photo_path = os.path.join(app.config['UPLOAD_FOLDER'], student_to_delete['photo'])
        if os.path.exists(photo_path):
            os.remove(photo_path)

    updated_students = [s for s in students if s['id'] != student_id]
    save_students(course, year, section, updated_students)
    return jsonify({'success': True})

# Edit student
@app.route('/edit_student/<course>/<year>/<section>/<student_id>', methods=['PUT'])
def edit_student(course, year, section, student_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    students = get_students(course, year, section)
    data = request.form if request.form else request.get_json()

    student_found = False
    for student in students:
        if student['id'] == student_id:
            student_found = True
            # Update fields if present in data
            for key in ['name', 'rollNumber', 'email', 'phone', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone', 'secretPassword']:
                if key in data:
                    student[key] = data[key]

            # Handle photo upload if present
            if 'studentPhoto' in request.files:
                file = request.files['studentPhoto']
                if file and file.filename != '' and allowed_file(file.filename):
                    # Delete the old photo file if it exists
                    if student.get('photo'):
                        old_photo_path = os.path.join(app.config['UPLOAD_FOLDER'], student['photo'])
                        if os.path.exists(old_photo_path):
                            os.remove(old_photo_path)

                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"{uuid.uuid4().hex}.{ext}"
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    student['photo'] = filename
            break

    if not student_found:
        return jsonify({'success': False, 'error': 'Student not found'})

    save_students(course, year, section, students)
    return jsonify({'success': True})

# Secondary Admin (Faculty) management
@app.route('/get_secondary_admins/<course>/<year>/<section>')
def get_secondary_admins_api(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        admins = get_secondary_admins(course, year, section)
        return jsonify(admins)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/add_secondary_admin/<course>/<year>/<section>', methods=['POST'])
def add_secondary_admin(course, year, section):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.form
    admins = get_secondary_admins(course, year, section)

    # Handle file upload
    photo_filename = None
    if 'profPhoto' in request.files:
        file = request.files['profPhoto']
        if file and file.filename != '' and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            photo_filename = filename

    prof_id = f"professor_{len(admins) + 1:03d}"

    # Normalize subjects (required)
    subjects_raw = (data.get('subjects') or '').strip()
    if not subjects_raw:
        return jsonify({'success': False, 'error': 'Subjects are required'}), 400
    subjects = [s.strip() for s in subjects_raw.split(',') if s.strip()]

    from datetime import datetime

    admin_data = {
        'id': prof_id,
        'name': data.get('name'),
        'userId': data.get('userId'),
        'password': data.get('password'),
        'email': data.get('email'),
        'phone': data.get('phone'),
        'fatherName': data.get('fatherName'),
        'fatherPhone': data.get('fatherPhone'),
        'motherName': data.get('motherName'),
        'motherPhone': data.get('motherPhone'),
        'photo': photo_filename,
        'subjects': subjects,
        'createdAt': data.get('createdAt', datetime.now().isoformat())
    }

    admins.append(admin_data)
    save_secondary_admins(course, year, section, admins)

    # Auto-create assigned subjects in attendance for this section
    try:
        att = load_attendance(course, year, section)
        att_subjects = set(att.get('subjects') or [])
        new_subjects = [s for s in (admin_data.get('subjects') or []) if s and s not in att_subjects]
        if new_subjects:
            # add to subjects list
            att['subjects'] = list(att_subjects.union(new_subjects))
        # ensure records dict for all subjects (existing + new)
        att.setdefault('records', {})
        for s in (admin_data.get('subjects') or []):
            att['records'].setdefault(s, {})
        save_attendance(course, year, section, att)
    except Exception as e:
        print(f"Warning: failed to sync subjects to attendance: {e}")

    return jsonify({'success': True, 'professorId': prof_id})


@app.route('/edit_secondary_admin/<course>/<year>/<section>/<prof_id>', methods=['PUT'])
def edit_secondary_admin(course, year, section, prof_id):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    admins = get_secondary_admins(course, year, section)
    data = request.form if request.form else request.get_json()

    found = False
    for adm in admins:
        if adm['id'] == prof_id:
            found = True
            for key in ['name', 'userId', 'password', 'email', 'phone', 'fatherName', 'fatherPhone', 'motherName', 'motherPhone']:
                if key in data:
                    adm[key] = data[key]
            # Handle subjects
            subj_raw = (data.get('subjects') or '').strip() if hasattr(data, 'get') else ''
            if subj_raw:
                adm['subjects'] = [s.strip() for s in subj_raw.split(',') if s.strip()]
            # Handle photo
            if 'profPhoto' in request.files:
                file = request.files['profPhoto']
                if file and file.filename != '' and allowed_file(file.filename):
                    if adm.get('photo'):
                        old_photo_path = os.path.join(app.config['UPLOAD_FOLDER'], adm['photo'])
                        if os.path.exists(old_photo_path):
                            os.remove(old_photo_path)
                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"{uuid.uuid4().hex}.{ext}"
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    adm['photo'] = filename
            break

    if not found:
        return jsonify({'success': False, 'error': 'Secondary admin not found'})

    save_secondary_admins(course, year, section, admins)
    return jsonify({'success': True})


@app.route('/delete_secondary_admin/<course>/<year>/<section>/<prof_id>', methods=['DELETE'])
def delete_secondary_admin(course, year, section, prof_id):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    admins = get_secondary_admins(course, year, section)

    target = None
    for adm in admins:
        if adm['id'] == prof_id:
            target = adm
            break

    if not target:
        return jsonify({'success': False, 'error': 'Secondary admin not found'})

    if target.get('photo'):
        photo_path = os.path.join(app.config['UPLOAD_FOLDER'], target['photo'])
        if os.path.exists(photo_path):
            os.remove(photo_path)

    admins = [a for a in admins if a['id'] != prof_id]
    save_secondary_admins(course, year, section, admins)
    return jsonify({'success': True})

# Activity management
@app.route('/get_activities/<course>/<year>/<section>')
def get_activities_api(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        activities = get_activities(course, year, section)
        return jsonify(activities)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/add_activity/<course>/<year>/<section>', methods=['POST'])
def add_activity(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    activities = get_activities(course, year, section)

    # Generate a unique ID for the activity
    activity_id = f"activity_{len(activities) + 1:03d}"

    activity_data = {
        'id': activity_id,
        'name': data.get('name'),
        'details': data.get('details'),
        'createdAt': data.get('createdAt')
    }

    activities.append(activity_data)
    save_activities(course, year, section, activities)

    return jsonify({'success': True, 'activityId': activity_id})

# Delete activity
@app.route('/delete_activity/<course>/<year>/<section>/<activity_id>', methods=['DELETE'])
def delete_activity(course, year, section, activity_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    activities = get_activities(course, year, section)
    updated_activities = [a for a in activities if a['id'] != activity_id]

    if len(updated_activities) == len(activities):
        return jsonify({'success': False, 'error': 'Activity not found'})

    save_activities(course, year, section, updated_activities)
    return jsonify({'success': True})

# Edit activity
@app.route('/edit_activity/<course>/<year>/<section>/<activity_id>', methods=['PUT'])
def edit_activity(course, year, section, activity_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    activities = get_activities(course, year, section)
    data = request.get_json()

    activity_found = False
    for activity in activities:
        if activity['id'] == activity_id:
            activity_found = True
            # Update fields if present in data
            for key in ['name', 'details']:
                if key in data:
                    activity[key] = data[key]
            break

    if not activity_found:
        return jsonify({'success': False, 'error': 'Activity not found'})

    save_activities(course, year, section, activities)
    return jsonify({'success': True})

# Student activity assignment
@app.route('/assign_activities/<course>/<year>/<section>/<student_id>', methods=['POST'])
def assign_activities(course, year, section, student_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    students = get_students(course, year, section)

    # Find the student and update their activities
    for student in students:
        if student['id'] == student_id:
            student['assignedActivities'] = data.get('activities', [])
            student['remarks'] = data.get('remarks', '')
            break

    save_students(course, year, section, students)
    return jsonify({'success': True})

# Attendance management routes
@app.route('/attendance')
def attendance_page():
    # Render attendance page for admin roles
    if not is_admin():
        return redirect(url_for('index'))
    return render_template('attendance.html')


@app.route('/attendance/subjects/<course>/<year>/<section>')
def get_attendance_subjects(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_attendance(course, year, section)
    # If secondary admin, restrict to their assigned subjects and their assigned section only
    if session.get('user_type') == 'secondary':
        ctx = session.get('secondary_admin') or {}
        if not (ctx.get('course') == course and ctx.get('year') == year and ctx.get('section') == section):
            return jsonify({'error': 'Unauthorized'}), 401
        prof_subs = set((ctx.get('profile') or {}).get('subjects') or [])
        # Auto-sync: ensure teacher's subjects exist in attendance store for this section
        if prof_subs:
            changed = False
            subjects = set(data.get('subjects') or [])
            missing = [s for s in prof_subs if s not in subjects]
            if missing:
                subjects.update(prof_subs)
                data['subjects'] = list(subjects)
                data.setdefault('records', {})
                for s in prof_subs:
                    if s not in data['records']:
                        data['records'][s] = {}
                save_attendance(course, year, section, data)
            return jsonify(sorted(list(prof_subs)))
        return jsonify([])
    return jsonify(data.get('subjects', []))


@app.route('/attendance/subjects/<course>/<year>/<section>', methods=['POST'])
def add_attendance_subject(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    payload = request.get_json()
    name = (payload.get('name') if payload else None)
    if not name:
        return jsonify({'success': False, 'error': 'Subject name is required'}), 400

    # Permissions: secondary admins can only add subjects assigned to them and only within their section
    utype = session.get('user_type')
    if utype == 'secondary':
        ctx = session.get('secondary_admin') or {}
        if not (ctx.get('course') == course and ctx.get('year') == year and ctx.get('section') == section):
            return jsonify({'error': 'Unauthorized'}), 401
        assigned = set((ctx.get('profile') or {}).get('subjects') or [])
        if name not in assigned:
            return jsonify({'success': False, 'error': 'You can only add your assigned subjects'}), 403

    data = load_attendance(course, year, section)
    subjects = data.get('subjects', [])
    if name in subjects:
        return jsonify({'success': False, 'error': 'Subject already exists'})
    subjects.append(name)
    data['subjects'] = subjects
    data.setdefault('records', {})
    data['records'].setdefault(name, {})
    save_attendance(course, year, section, data)
    return jsonify({'success': True})


@app.route('/attendance/subjects/<course>/<year>/<section>/<subject>', methods=['DELETE'])
def delete_attendance_subject(course, year, section, subject):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_attendance(course, year, section)
    subjects = data.get('subjects', [])
    if subject not in subjects:
        return jsonify({'success': False, 'error': 'Subject not found'})
    subjects = [s for s in subjects if s != subject]
    data['subjects'] = subjects
    # Remove related records
    if 'records' in data and subject in data['records']:
        del data['records'][subject]
    save_attendance(course, year, section, data)
    return jsonify({'success': True})


@app.route('/attendance/records/<course>/<year>/<section>')
def get_attendance_records(course, year, section):
    # Both admin roles and students can view, but students limited to their own
    data = load_attendance(course, year, section)
    subject = request.args.get('subject')
    student_id = request.args.get('studentId')
    if not subject or not student_id:
        return jsonify({'error': 'subject and studentId are required'}), 400
    # If secondary admin, restrict by assigned section and subjects
    if session.get('user_type') == 'secondary':
        ctx = session.get('secondary_admin') or {}
        if not (ctx.get('course') == course and ctx.get('year') == year and ctx.get('section') == section):
            return jsonify({'error': 'Unauthorized'}), 401
        assigned = set((ctx.get('profile') or {}).get('subjects') or [])
        if subject not in assigned:
            return jsonify({'error': 'Unauthorized'}), 401
    entry = get_att_rec_entry(data, subject, student_id)
    # Detailed view returns counts for present and absent
    if request.args.get('detailed') == '1':
        return jsonify({'present': entry.get('present', {}), 'absent': entry.get('absent', {})})
    # Legacy: return expanded present-only dates (duplicates reflect periods)
    return jsonify(expand_counts(entry.get('present', {})))


@app.route('/attendance/records/<course>/<year>/<section>', methods=['POST'])
def save_attendance_records(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    payload = request.get_json() or {}
    subject = payload.get('subject')
    student_id = payload.get('studentId')
    dates = payload.get('dates') or []
    if not subject or not student_id:
        return jsonify({'success': False, 'error': 'subject and studentId are required'}), 400
    # For secondary admin, enforce they can only mark within their section and assigned subjects
    if session.get('user_type') == 'secondary':
        ctx = session.get('secondary_admin') or {}
        if not (ctx.get('course') == course and ctx.get('year') == year and ctx.get('section') == section):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        assigned = set((ctx.get('profile') or {}).get('subjects') or [])
        if subject not in assigned:
            return jsonify({'success': False, 'error': 'You can only mark attendance for your assigned subjects'}), 403
    # Normalize dates to YYYY-MM-DD
    norm_dates = []
    for d in dates:
        try:
            norm_dates.append(str(d)[:10])
        except Exception:
            continue
    data = load_attendance(course, year, section)
    data.setdefault('subjects', [])
    if subject not in data['subjects']:
        data['subjects'].append(subject)

    # New model: counts per date, with status present/absent and operations
    status = (payload.get('status') or '').strip().lower()
    op = (payload.get('operation') or payload.get('op') or '').strip().lower()
    count = payload.get('count')

    entry = get_att_rec_entry(data, subject, student_id)

    if status in {'present', 'absent'} or op or (count is not None):
        if status not in {'present', 'absent'}:
            status = 'present'
        if not op:
            op = 'increment'
        # default increment by 1 if not provided
        try:
            num = int(count) if count is not None else (1 if op == 'increment' else 0)
        except Exception:
            num = 1 if op == 'increment' else 0
        # apply per date
        for day in norm_dates:
            cur = int(entry[status].get(day, 0))
            if op == 'set':
                entry[status][day] = max(int(count or 0), 0)
            elif op in {'decrement', 'dec'}:
                entry[status][day] = max(cur - (int(count or 1)), 0)
            else:  # increment default
                entry[status][day] = cur + (int(count or 1))
        save_att_rec_entry(data, subject, student_id, entry)
    else:
        # Legacy behavior: replace present dates with single count each
        entry['present'] = {}
        for day in norm_dates:
            entry['present'][day] = 1
        # Keep existing absent counts intact
        save_att_rec_entry(data, subject, student_id, entry)

    save_attendance(course, year, section, data)
    return jsonify({'success': True})

# Attendance issues APIs
@app.route('/attendance_issues/<course>/<year>/<section>')
def get_attendance_issues(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    subject = request.args.get('subject')
    data = load_attendance_issues(course, year, section)
    issues = data.get('issues', [])
    if subject:
        issues = [i for i in issues if i.get('subject') == subject]
    return jsonify(issues)


@app.route('/student_attendance_issue', methods=['POST'])
def submit_student_attendance_issue():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    payload = request.get_json() or {}
    subject = payload.get('subject')
    dates = payload.get('dates') or []
    description = payload.get('description', '').strip()
    if not subject or not dates or not description:
        return jsonify({'success': False, 'error': 'subject, dates and description are required'}), 400
    # Normalize dates
    norm_dates = []
    for d in dates:
        try:
            norm_dates.append(str(d)[:10])
        except Exception:
            continue
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data')
    if not all([course, year, section, student]):
        return jsonify({'success': False, 'error': 'Student context missing'}), 400
    data = load_attendance_issues(course, year, section)
    issues = data.get('issues', [])
    issue = {
        'id': f"issue_{uuid.uuid4().hex[:8]}",
        'studentId': student.get('id'),
        'studentName': student.get('name'),
        'subject': subject,
        'dates': sorted(list(set(norm_dates))),
        'description': description,
        'createdAt': __import__('datetime').datetime.now().isoformat(),
        'status': 'open'
    }
    issues.append(issue)
    data['issues'] = issues
    save_attendance_issues(course, year, section, data)
    return jsonify({'success': True})


@app.route('/attendance_issues/<course>/<year>/<section>/<issue_id>', methods=['PUT'])
def update_attendance_issue(course, year, section, issue_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    payload = request.get_json() or {}
    new_status = (payload.get('status') or '').strip().lower()
    if new_status not in {'open', 'accepted', 'resolved', 'rejected'}:
        return jsonify({'success': False, 'error': 'Invalid status'}), 400
    data = load_attendance_issues(course, year, section)
    issues = data.get('issues', [])
    updated = False
    for i in issues:
        if i.get('id') == issue_id:
            i['status'] = new_status
            # Optionally add a facultyNote
            if 'note' in payload:
                i['facultyNote'] = payload.get('note')
            updated = True
            break
    if not updated:
        return jsonify({'success': False, 'error': 'Issue not found'}), 404
    data['issues'] = issues
    save_attendance_issues(course, year, section, data)
    return jsonify({'success': True})

# Student dashboard data
@app.route('/student_data')
def student_data():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    student = session.get('student_data')
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')

    if not all([student, course, year, section]):
        return jsonify({'error': 'Student data not found'}), 404

    # Get activities for the student's section
    activities = get_activities(course, year, section)

    # Filter to only include activities assigned to the student
    student_activities = []
    for activity in activities:
        if activity['id'] in student.get('assignedActivities', []):
            activity_with_status = activity.copy()
            activity_with_status['status'] = student.get('remarks', 'participated')
            student_activities.append(activity_with_status)

    return jsonify({
        'student': student,
        'activities': student_activities,
        'course': course,
        'year': year,
        'section': section
    })

# Serve uploaded files
# Student attendance APIs
@app.route('/student_self_update', methods=['POST'])
def student_self_update():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data') or {}
    if not all([course, year, section, student]):
        return jsonify({'success': False, 'error': 'Student context missing'}), 400
    students = get_students(course, year, section)
    # Find current student index
    idx = -1
    for i, s in enumerate(students):
        if s.get('id') == student.get('id'):
            idx = i
            break
    if idx < 0:
        return jsonify({'success': False, 'error': 'Student not found'}), 404
    cur = students[idx]

    # Handle password change (optional)
    new_pw = (request.form.get('newPassword') or '').strip()
    cur_pw = request.form.get('currentPassword') or ''
    if new_pw:
        if not cur_pw or cur_pw != (cur.get('secretPassword') or ''):
            return jsonify({'success': False, 'error': 'Current password is incorrect'}), 400
        cur['secretPassword'] = new_pw

    # Handle profile photo change (optional)
    if 'studentPhoto' in request.files:
        f = request.files['studentPhoto']
        if f and f.filename and allowed_file(f.filename):
            # Delete old photo if exists
            try:
                old = cur.get('photo')
                if old:
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], old)
                    if os.path.exists(old_path):
                        os.remove(old_path)
            except Exception:
                pass
            ext = f.filename.rsplit('.', 1)[-1].lower()
            saved = f"{uuid.uuid4().hex}.{ext}"
            f.save(os.path.join(app.config['UPLOAD_FOLDER'], saved))
            cur['photo'] = saved

    # Persist
    students[idx] = cur
    save_students(course, year, section, students)
    # Update session
    session['student_data'] = cur

    return jsonify({'success': True, 'student': {'id': cur.get('id'), 'photo': cur.get('photo')}})

@app.route('/student_attendance_subjects')
def student_attendance_subjects():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    if not all([course, year, section]):
        return jsonify({'error': 'Student context missing'}), 400
    data = load_attendance(course, year, section)
    return jsonify(data.get('subjects', []))


@app.route('/student_attendance_records')
def student_attendance_records():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data')
    subject = request.args.get('subject')
    if not all([course, year, section, student, subject]):
        return jsonify({'error': 'Missing parameters'}), 400
    data = load_attendance(course, year, section)
    entry = get_att_rec_entry(data, subject, student.get('id'))
    # Detailed response returns counts for both present and absent per day
    if request.args.get('detailed') == '1':
        return jsonify({'present': entry.get('present', {}), 'absent': entry.get('absent', {})})
    # Legacy: return expanded present dates list (duplicates reflect periods)
    return jsonify(expand_counts(entry.get('present', {})))


@app.route('/student_attendance_issues')
def student_attendance_issues():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data')
    if not all([course, year, section, student]):
        return jsonify({'error': 'Student context missing'}), 400
    subject = request.args.get('subject')
    data = load_attendance_issues(course, year, section)
    issues = [i for i in data.get('issues', []) if i.get('studentId') == student.get('id')]
    if subject:
        issues = [i for i in issues if i.get('subject') == subject]
    return jsonify(issues)


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/logout')

def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/whoami')
def whoami():
    return jsonify({'userType': session.get('user_type'), 'userId': session.get('user_id') or session.get('userId')})

# Messages storage helpers

def get_messages_path(course, year, section):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    return os.path.join(section_path, 'messages.json')


def load_messages(course, year, section):
    path = get_messages_path(course, year, section)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {"threads": {}}
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading messages file: {e}")
            return {"threads": {}}
    data = {"threads": {}}
    save_messages(course, year, section, data)
    return data


def save_messages(course, year, section, data):
    path = get_messages_path(course, year, section)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Chat (group) storage helpers

def get_chat_path(course, year, section):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    return os.path.join(section_path, 'chat.json')


def load_chat(course, year, section):
    path = get_chat_path(course, year, section)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {"groups": {}, "messages": {}}
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading chat file: {e}")
            return {"groups": {}, "messages": {}}
    data = {"groups": {}, "messages": {}}
    save_chat(course, year, section, data)
    return data


def save_chat(course, year, section, data):
    path = get_chat_path(course, year, section)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Certificates storage helpers

def get_certificates_path(course, year, section):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    return os.path.join(section_path, 'certificates.json')


def load_certificates(course, year, section):
    path = get_certificates_path(course, year, section)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {"byStudent": {}}
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading certificates file: {e}")
            return {"byStudent": {}}
    data = {"byStudent": {}}
    save_certificates(course, year, section, data)
    return data


def save_certificates(course, year, section, data):
    path = get_certificates_path(course, year, section)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Scrutiny storage helpers

def get_scrutiny_path(course, year, section):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    return os.path.join(section_path, 'scrutiny.json')


def load_scrutiny(course, year, section):
    path = get_scrutiny_path(course, year, section)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {"requests": []}
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading scrutiny file: {e}")
            return {"requests": []}
    data = {"requests": []}
    save_scrutiny(course, year, section, data)
    return data


def save_scrutiny(course, year, section, data):
    path = get_scrutiny_path(course, year, section)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Certificates APIs

@app.route('/certificates/<course>/<year>/<section>')
def get_certificates_api(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    student_id = request.args.get('studentId')
    if not student_id:
        return jsonify({'error': 'studentId is required'}), 400
    data = load_certificates(course, year, section)
    out = data.get('byStudent', {}).get(student_id, [])
    return jsonify(out)


@app.route('/certificates/<course>/<year>/<section>', methods=['POST'])
def add_certificate_api(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    # Accept multipart form
    student_id = request.form.get('studentId')
    name = (request.form.get('name') or '').strip()
    file = request.files.get('certFile') if request.files else None
    if not student_id or not name or not file or not file.filename:
        return jsonify({'success': False, 'error': 'studentId, name and certFile are required'}), 400
    # Save file with any extension
    orig_fn = secure_filename(file.filename)
    ext = orig_fn.rsplit('.', 1)[-1].lower() if '.' in orig_fn else ''
    saved = f"cert_{uuid.uuid4().hex}.{ext}" if ext else f"cert_{uuid.uuid4().hex}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], saved)
    file.save(save_path)
    # Uploader info
    utype = session.get('user_type')
    uploader_id = session.get('user_id') or session.get('userId') or ''
    uploader_name = uploader_id
    if utype == 'faculty':
        uploader_id = 'faculty'
        uploader_name = 'Main Admin'
    elif utype == 'secondary':
        prof = (session.get('secondary_admin') or {}).get('profile') or {}
        if prof.get('name'):
            uploader_name = prof.get('name')
    entry = {
        'id': f"cert_{uuid.uuid4().hex[:8]}",
        'name': name,
        'filename': orig_fn,
        'url': url_for('uploaded_file', filename=saved),
        'storedFilename': saved,
        'uploadedAt': __import__('datetime').datetime.now().isoformat(),
        'uploadedBy': {'type': 'teacher', 'id': uploader_id, 'name': uploader_name}
    }
    data = load_certificates(course, year, section)
    data.setdefault('byStudent', {})
    data['byStudent'].setdefault(student_id, [])
    data['byStudent'][student_id].append(entry)
    save_certificates(course, year, section, data)
    return jsonify({'success': True, 'certificate': entry})


@app.route('/certificates/<course>/<year>/<section>/<cert_id>', methods=['DELETE'])
def delete_certificate_api(course, year, section, cert_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    student_id = request.args.get('studentId')
    if not student_id:
        return jsonify({'success': False, 'error': 'studentId is required'}), 400
    data = load_certificates(course, year, section)
    by = data.get('byStudent', {})
    arr = by.get(student_id, [])
    found = None
    idx = -1
    for i, e in enumerate(arr):
        if e.get('id') == cert_id:
            found = e
            idx = i
            break
    if found is None:
        return jsonify({'success': False, 'error': 'Certificate not found'}), 404
    # remove from list
    arr.pop(idx)
    by[student_id] = arr
    data['byStudent'] = by
    # delete stored file if present
    saved_name = found.get('storedFilename')
    if not saved_name:
        try:
            url = found.get('url') or ''
            saved_name = url.rsplit('/', 1)[-1] if '/uploads/' in url else None
        except Exception:
            saved_name = None
    if saved_name:
        try:
            fpath = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
            if os.path.exists(fpath):
                os.remove(fpath)
        except Exception:
            pass
    save_certificates(course, year, section, data)
    return jsonify({'success': True})


@app.route('/student_certificates')
def student_certificates():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data') or {}
    if not all([course, year, section, student]):
        return jsonify({'error': 'Student context missing'}), 400
    data = load_certificates(course, year, section)
    out = data.get('byStudent', {}).get(student.get('id'), [])
    return jsonify(out)

# Scrutiny APIs (certificate verification workflow)

@app.route('/scrutiny/student_submit', methods=['POST'])
def scrutiny_student_submit():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    description = (request.form.get('description') or '').strip()
    file = request.files.get('file') if request.files else None
    if not description or not file or not file.filename:
        return jsonify({'success': False, 'error': 'description and file are required'}), 400
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data') or {}
    if not all([course, year, section, student]):
        return jsonify({'success': False, 'error': 'Student context missing'}), 400
    fn = secure_filename(file.filename)
    ext = fn.rsplit('.', 1)[-1].lower() if '.' in fn else ''
    saved = f"scr_{uuid.uuid4().hex}.{ext}" if ext else f"scr_{uuid.uuid4().hex}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], saved)
    file.save(save_path)
    item = {
        'id': f"scr_{uuid.uuid4().hex[:8]}",
        'studentId': student.get('id'),
        'studentName': student.get('name'),
        'description': description,
        'file': {'filename': fn, 'url': url_for('uploaded_file', filename=saved), 'storedFilename': saved},
        'status': 'pending',
        'remark': '',
        'submittedAt': __import__('datetime').datetime.now().isoformat()
    }
    data = load_scrutiny(course, year, section)
    reqs = data.setdefault('requests', [])
    reqs.append(item)
    save_scrutiny(course, year, section, data)
    return jsonify({'success': True, 'item': item})


@app.route('/student_scrutiny')
def student_scrutiny():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data') or {}
    if not all([course, year, section, student]):
        return jsonify({'error': 'Student context missing'}), 400
    data = load_scrutiny(course, year, section)
    out = [r for r in data.get('requests', []) if r.get('studentId') == student.get('id')]
    return jsonify(out)


@app.route('/scrutiny/<course>/<year>/<section>')
def list_scrutiny(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_scrutiny(course, year, section)
    return jsonify(data.get('requests', []))


@app.route('/scrutiny/<course>/<year>/<section>/<req_id>', methods=['PUT'])
def update_scrutiny(course, year, section, req_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    payload = request.get_json() or {}
    status = (payload.get('status') or '').strip()
    remark = (payload.get('remark') or '').strip()
    data = load_scrutiny(course, year, section)
    reqs = data.get('requests', [])
    updated = False
    for r in reqs:
        if r.get('id') == req_id:
            if status:
                r['status'] = status
            if 'remark' in payload:
                r['remark'] = remark
            r['remarkedAt'] = __import__('datetime').datetime.now().isoformat()
            utype = session.get('user_type')
            who_name = 'Main Admin' if utype == 'faculty' else ((session.get('secondary_admin') or {}).get('profile') or {}).get('name')
            r['remarkedBy'] = {'type': 'teacher', 'id': session.get('user_id') or session.get('userId') or '', 'name': who_name}
            updated = True
            break
    if not updated:
        return jsonify({'success': False, 'error': 'Request not found'}), 404
    save_scrutiny(course, year, section, data)
    return jsonify({'success': True})


@app.route('/scrutiny/student/<req_id>', methods=['DELETE'])
def delete_student_scrutiny(req_id):
    # Student can delete their own submission at any time
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data') or {}
    if not all([course, year, section, student]):
        return jsonify({'success': False, 'error': 'Student context missing'}), 400
    data = load_scrutiny(course, year, section)
    reqs = data.get('requests', [])
    idx = -1
    target = None
    for i, r in enumerate(reqs):
        if r.get('id') == req_id and r.get('studentId') == student.get('id'):
            idx = i
            target = r
            break
    if idx < 0:
        return jsonify({'success': False, 'error': 'Submission not found'}), 404
    # Remove file if stored
    try:
        saved_name = (target.get('file') or {}).get('storedFilename')
        if saved_name:
            fpath = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
            if os.path.exists(fpath):
                os.remove(fpath)
    except Exception:
        pass
    # Remove entry and save
    reqs.pop(idx)
    data['requests'] = reqs
    save_scrutiny(course, year, section, data)
    return jsonify({'success': True})


def build_default_group(course, year, section):
    # returns group object constructed from current students and teachers
    students = get_students(course, year, section)
    teachers = get_secondary_admins(course, year, section)
    members = []
    # main admin
    members.append({"type": "teacher", "id": "faculty", "name": "Main Admin"})
    # secondary admins
    for t in (teachers or []):
        uid = t.get('userId')
        if uid:
            members.append({"type": "teacher", "id": uid, "name": t.get('name')})
    # students
    for s in (students or []):
        if s.get('id'):
            members.append({"type": "student", "id": s.get('id'), "name": s.get('name')})
    g = {
        "id": "group_all",
        "name": "All Members",
        "bio": "Auto-created group for this section",
        "photo": None,
        "members": members,
        "permissions": {"whoCanChat": "all", "allowedMemberIds": []},
        "createdAt": __import__('datetime').datetime.now().isoformat()
    }
    return g


def member_key(mtype, mid):
    return f"{mtype}:{mid}"


def can_send_in_group(group, sender_type, sender_id):
    perms = group.get('permissions') or {}
    mode = (perms.get('whoCanChat') or 'all').lower()
    key = member_key(sender_type, sender_id)
    if mode == 'all':
        return True
    if mode in ('teachers_only', 'admins_only'):
        return sender_type == 'teacher'
    if mode == 'main_admin_only':
        return sender_type == 'teacher' and sender_id == 'faculty'
    if mode == 'custom':
        allowed = set(perms.get('allowedMemberIds') or [])
        return key in allowed
    return True

# Groups APIs

@app.route('/groups/<course>/<year>/<section>')
def list_groups(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_chat(course, year, section)
    groups = list((data.get('groups') or {}).values())
    # augment with counts
    for g in groups:
        g['memberCount'] = len(g.get('members', []))
    return jsonify(groups)


@app.route('/groups/<course>/<year>/<section>/auto', methods=['POST'])
def ensure_auto_group(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_chat(course, year, section)
    groups = data.setdefault('groups', {})
    grp = groups.get('group_all')
    if not grp:
        grp = build_default_group(course, year, section)
        groups['group_all'] = grp
        save_chat(course, year, section, data)
    else:
        # Refresh membership to keep up-to-date
        new_grp = build_default_group(course, year, section)
        grp['members'] = new_grp['members']
        save_chat(course, year, section, data)
    return jsonify({'success': True, 'group': grp})


@app.route('/groups/<course>/<year>/<section>/custom', methods=['POST'])
def create_custom_group(course, year, section):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    # multipart supported
    name = None
    bio = None
    members = []
    photo_file = None
    if request.content_type and 'application/json' in request.content_type:
        payload = request.get_json() or {}
        name = (payload.get('name') or '').strip() or 'New Group'
        bio = (payload.get('bio') or '').strip()
        members = payload.get('members') or []
    else:
        name = (request.form.get('name') or '').strip() or 'New Group'
        bio = (request.form.get('bio') or '').strip()
        mem_raw = request.form.get('members')  # expect JSON string or comma-separated keys
        if mem_raw:
            try:
                members = json.loads(mem_raw)
            except Exception:
                members = [m.strip() for m in mem_raw.split(',') if m.strip()]
        if 'groupPhoto' in request.files:
            photo_file = request.files['groupPhoto']
    data = load_chat(course, year, section)
    groups = data.setdefault('groups', {})
    gid = f"group_{uuid.uuid4().hex[:8]}"
    photo_name = None
    if photo_file and photo_file.filename:
        fn = secure_filename(photo_file.filename)
        ext = fn.rsplit('.', 1)[-1].lower() if '.' in fn else ''
        saved = f"group_{uuid.uuid4().hex}.{ext}" if ext else f"group_{uuid.uuid4().hex}"
        photo_file.save(os.path.join(app.config['UPLOAD_FOLDER'], saved))
        photo_name = saved
    # Build member objects from keys like 'student:<id>' or 'teacher:<id>'
    member_objs = []
    # include only valid
    # Preload data
    students = {s.get('id'): s for s in get_students(course, year, section)}
    teachers = {a.get('userId'): a for a in get_secondary_admins(course, year, section)}
    for k in set(members or []):
        parts = str(k).split(':', 1)
        if len(parts) != 2:
            continue
        mtype, mid = parts[0], parts[1]
        if mtype == 'student' and mid in students:
            member_objs.append({'type': 'student', 'id': mid, 'name': students[mid].get('name')})
        elif mtype == 'teacher':
            if mid == 'faculty':
                member_objs.append({'type': 'teacher', 'id': 'faculty', 'name': 'Main Admin'})
            elif mid in teachers:
                member_objs.append({'type': 'teacher', 'id': mid, 'name': teachers[mid].get('name')})
    group = {
        'id': gid,
        'name': name,
        'bio': bio,
        'photo': photo_name,
        'members': member_objs,
        'permissions': {'whoCanChat': 'all', 'allowedMemberIds': []},
        'createdAt': __import__('datetime').datetime.now().isoformat()
    }
    groups[gid] = group
    save_chat(course, year, section, data)
    return jsonify({'success': True, 'group': group})


@app.route('/groups/<course>/<year>/<section>/<group_id>', methods=['PUT'])
def update_group(course, year, section, group_id):
    if not is_main_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_chat(course, year, section)
    group = (data.get('groups') or {}).get(group_id)
    if not group:
        return jsonify({'success': False, 'error': 'Group not found'}), 404
    photo_file = None
    if request.content_type and 'application/json' in request.content_type:
        payload = request.get_json() or {}
        if 'name' in payload:
            group['name'] = (payload.get('name') or '').strip() or group.get('name')
        if 'bio' in payload:
            group['bio'] = (payload.get('bio') or '').strip()
        perms = payload.get('permissions')
        if isinstance(perms, dict):
            group['permissions'] = {'whoCanChat': perms.get('whoCanChat', 'all'), 'allowedMemberIds': perms.get('allowedMemberIds') or []}
    else:
        if 'name' in request.form:
            group['name'] = (request.form.get('name') or '').strip() or group.get('name')
        if 'bio' in request.form:
            group['bio'] = (request.form.get('bio') or '').strip()
        if 'permissions' in request.form:
            try:
                perms = json.loads(request.form.get('permissions'))
                if isinstance(perms, dict):
                    group['permissions'] = {'whoCanChat': perms.get('whoCanChat', 'all'), 'allowedMemberIds': perms.get('allowedMemberIds') or []}
            except Exception:
                pass
        if 'groupPhoto' in request.files:
            photo_file = request.files['groupPhoto']
    if photo_file and photo_file.filename:
        fn = secure_filename(photo_file.filename)
        ext = fn.rsplit('.', 1)[-1].lower() if '.' in fn else ''
        saved = f"group_{uuid.uuid4().hex}.{ext}" if ext else f"group_{uuid.uuid4().hex}"
        photo_file.save(os.path.join(app.config['UPLOAD_FOLDER'], saved))
        group['photo'] = saved
    save_chat(course, year, section, data)
    return jsonify({'success': True, 'group': group})


@app.route('/groups/messages/<course>/<year>/<section>/<group_id>')
def get_group_messages(course, year, section, group_id):
    utype = session.get('user_type')
    if utype not in {'faculty', 'secondary', 'student'}:
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_chat(course, year, section)
    group = (data.get('groups') or {}).get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    # students can only access if they are members
    if utype == 'student':
        student = session.get('student_data') or {}
        sid = student.get('id')
        if not any(m for m in group.get('members', []) if m.get('type') == 'student' and m.get('id') == sid):
            return jsonify({'error': 'Unauthorized'}), 401
    # OK for admins
    msgs = (data.get('messages') or {}).get(group_id, [])
    return jsonify(msgs)


@app.route('/groups/messages/<course>/<year>/<section>/<group_id>', methods=['POST'])
def send_group_message(course, year, section, group_id):
    utype = session.get('user_type')
    if utype not in {'faculty', 'secondary', 'student'}:
        return jsonify({'error': 'Unauthorized'}), 401
    data = load_chat(course, year, section)
    group = (data.get('groups') or {}).get(group_id)
    if not group:
        return jsonify({'success': False, 'error': 'Group not found'}), 404
    # Determine sender
    if utype == 'student':
        student = session.get('student_data') or {}
        sender_type = 'student'
        sender_id = student.get('id')
        # ensure student is member
        if not any(m for m in group.get('members', []) if m.get('type') == 'student' and m.get('id') == sender_id):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    else:
        # admin
        sender_type = 'teacher'
        sender_id = session.get('user_id') or session.get('userId')
        if session.get('user_type') == 'faculty':
            sender_id = 'faculty'
        # ensure teacher in the section's group; if not, allow main admin implicitly
        if not any(m for m in group.get('members', []) if m.get('type') == 'teacher' and m.get('id') == sender_id):
            # auto-add teacher if main faculty
            if sender_id == 'faculty':
                group.setdefault('members', []).append({'type': 'teacher', 'id': 'faculty', 'name': 'Main Admin'})
            else:
                return jsonify({'success': False, 'error': 'Unauthorized'}), 401
    # permissions
    if not can_send_in_group(group, sender_type, sender_id):
        return jsonify({'success': False, 'error': 'Sending not allowed by group permissions'}), 403
    # payload
    if request.content_type and 'application/json' in request.content_type:
        payload = request.get_json() or {}
        text = (payload.get('text') or '').strip()
        files = []
    else:
        text = (request.form.get('text') or '').strip()
        files = request.files.getlist('files') if request.files else []
    # attachments
    atts = []
    for f in (files or []):
        if f and f.filename:
            fn = secure_filename(f.filename)
            ext = fn.rsplit('.', 1)[-1].lower() if '.' in fn else ''
            saved_name = f"grp_{uuid.uuid4().hex}.{ext}" if ext else f"grp_{uuid.uuid4().hex}"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
            f.save(save_path)
            atts.append({'filename': fn, 'url': url_for('uploaded_file', filename=saved_name)})
    msg = {
        'id': f"msg_{uuid.uuid4().hex[:8]}",
        'from': {'type': sender_type, 'id': sender_id},
        'text': text,
        'attachments': atts,
        'ts': __import__('datetime').datetime.now().isoformat()
    }
    msgs = data.setdefault('messages', {}).setdefault(group_id, [])
    msgs.append(msg)
    save_chat(course, year, section, data)
    return jsonify({'success': True, 'message': msg})


# Student endpoint to list teachers (secondary admins) for their section
# Notes storage helpers

def get_notes_path(course, year, section):
    section_path = os.path.join(DATA_DIR, course, year, section)
    if not os.path.exists(section_path):
        os.makedirs(section_path)
    return os.path.join(section_path, 'notes.json')


def load_notes(course, year, section):
    path = get_notes_path(course, year, section)
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {"bySubject": {}}
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Error reading notes file: {e}")
            return {"bySubject": {}}
    data = {"bySubject": {}}
    save_notes(course, year, section, data)
    return data


def save_notes(course, year, section, data):
    path = get_notes_path(course, year, section)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Notes APIs

@app.route('/notes/<course>/<year>/<section>')
def list_notes_api(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    subject = (request.args.get('subject') or '').strip()
    if not subject:
        return jsonify({'error': 'subject is required'}), 400
    # Permissions for secondary admin: enforce assigned section and subject
    if session.get('user_type') == 'secondary':
        ctx = session.get('secondary_admin') or {}
        if not (ctx.get('course') == course and ctx.get('year') == year and ctx.get('section') == section):
            return jsonify({'error': 'Unauthorized'}), 401
        assigned = set((ctx.get('profile') or {}).get('subjects') or [])
        if subject not in assigned:
            return jsonify({'error': 'Unauthorized'}), 401
    data = load_notes(course, year, section)
    out = (data.get('bySubject') or {}).get(subject, [])
    return jsonify(out)


@app.route('/notes/<course>/<year>/<section>', methods=['POST'])
def upload_note_api(course, year, section):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    # Accept multipart form
    subject = (request.form.get('subject') or '').strip()
    title = (request.form.get('title') or '').strip()
    description = (request.form.get('description') or '').strip()
    file = request.files.get('file') if request.files else None
    if not subject or not file or not file.filename:
        return jsonify({'success': False, 'error': 'subject and file are required'}), 400

    utype = session.get('user_type')
    # Secondary admin restriction: only their assigned section and subjects
    if utype == 'secondary':
        ctx = session.get('secondary_admin') or {}
        if not (ctx.get('course') == course and ctx.get('year') == year and ctx.get('section') == section):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        assigned = set((ctx.get('profile') or {}).get('subjects') or [])
        if subject not in assigned:
            return jsonify({'success': False, 'error': 'You can only upload to your assigned subjects'}), 403

    # If main admin uploads to a new subject, auto-add it to attendance subjects list
    if utype == 'faculty':
        try:
            att = load_attendance(course, year, section)
            subs = set(att.get('subjects') or [])
            if subject not in subs:
                subs.add(subject)
                att['subjects'] = list(subs)
                att.setdefault('records', {}).setdefault(subject, {})
                save_attendance(course, year, section, att)
        except Exception as e:
            print(f"Warning: failed to sync subject into attendance for notes: {e}")

    # Save file with original extension
    orig_fn = secure_filename(file.filename)
    ext = orig_fn.rsplit('.', 1)[-1].lower() if '.' in orig_fn else ''
    saved = f"note_{uuid.uuid4().hex}.{ext}" if ext else f"note_{uuid.uuid4().hex}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], saved)
    file.save(save_path)

    # Uploader info
    uploader_id = session.get('user_id') or session.get('userId') or ''
    uploader_name = 'Main Admin' if utype == 'faculty' else ((session.get('secondary_admin') or {}).get('profile') or {}).get('name') or uploader_id

    item = {
        'id': f"note_{uuid.uuid4().hex[:8]}",
        'subject': subject,
        'title': title or orig_fn,
        'description': description,
        'file': {'filename': orig_fn, 'url': url_for('uploaded_file', filename=saved), 'storedFilename': saved},
        'uploadedAt': __import__('datetime').datetime.now().isoformat(),
        'uploadedBy': {'type': 'teacher', 'id': uploader_id, 'name': uploader_name}
    }
    data = load_notes(course, year, section)
    by = data.setdefault('bySubject', {})
    by.setdefault(subject, [])
    by[subject].append(item)
    save_notes(course, year, section, data)
    return jsonify({'success': True, 'note': item})


@app.route('/notes/<course>/<year>/<section>/<note_id>', methods=['DELETE'])
def delete_note_api(course, year, section, note_id):
    # Allow main admin or secondary admin (restricted to their own section and assigned subjects)
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401

    # Load notes and locate the target note and its subject
    data = load_notes(course, year, section)
    by = data.get('bySubject') or {}
    target_subject = None
    target_note = None
    target_idx = -1
    for subj, arr in by.items():
        try:
            for i, n in enumerate(arr or []):
                if n.get('id') == note_id:
                    target_subject = subj
                    target_note = n
                    target_idx = i
                    break
            if target_note is not None:
                break
        except Exception:
            continue

    if target_note is None:
        return jsonify({'success': False, 'error': 'Note not found'}), 404

    # If secondary admin, enforce section and subject ownership of the note
    if session.get('user_type') == 'secondary':
        ctx = session.get('secondary_admin') or {}
        if not (ctx.get('course') == course and ctx.get('year') == year and ctx.get('section') == section):
            return jsonify({'error': 'Unauthorized'}), 401
        assigned = set((ctx.get('profile') or {}).get('subjects') or [])
        if target_subject not in assigned:
            return jsonify({'error': 'Unauthorized'}), 401

    # Delete stored file if present
    saved_name = (target_note.get('file') or {}).get('storedFilename')
    if not saved_name:
        try:
            url = (target_note.get('file') or {}).get('url') or ''
            saved_name = url.rsplit('/', 1)[-1] if '/uploads/' in url else None
        except Exception:
            saved_name = None
    if saved_name:
        try:
            fpath = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
            if os.path.exists(fpath):
                os.remove(fpath)
        except Exception:
            pass

    # Remove note from list and persist
    arr = by.get(target_subject, [])
    if 0 <= target_idx < len(arr):
        arr.pop(target_idx)
        by[target_subject] = arr
        data['bySubject'] = by
        save_notes(course, year, section, data)
    else:
        return jsonify({'success': False, 'error': 'Note not found'}), 404

    return jsonify({'success': True})
    data = load_notes(course, year, section)
    by = data.get('bySubject', {})
    found = None
    found_key = None
    idx = -1
    for subj, arr in by.items():
        for i, n in enumerate(arr or []):
            if n.get('id') == note_id:
                found = n
                found_key = subj
                idx = i
                break
        if found:
            break
    if found is None:
        return jsonify({'success': False, 'error': 'Note not found'}), 404
    # remove file
    try:
        saved_name = (found.get('file') or {}).get('storedFilename')
        if saved_name:
            path = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
            if os.path.exists(path):
                os.remove(path)
    except Exception:
        pass
    # remove entry
    try:
        by[found_key].pop(idx)
    except Exception:
        pass
    data['bySubject'] = by
    save_notes(course, year, section, data)
    return jsonify({'success': True})


@app.route('/student_notes')
def student_notes_api():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    subject = (request.args.get('subject') or '').strip()
    if not subject:
        return jsonify({'error': 'subject is required'}), 400
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    if not all([course, year, section]):
        return jsonify({'error': 'Student context missing'}), 400
    data = load_notes(course, year, section)
    notes = (data.get('bySubject') or {}).get(subject, [])
    # Return a student-safe version (no uploader ids)
    out = []
    for n in notes:
        out.append({
            'id': n.get('id'),
            'subject': n.get('subject'),
            'title': n.get('title'),
            'description': n.get('description'),
            'file': n.get('file'),
            'uploadedAt': n.get('uploadedAt'),
            'uploadedBy': {'name': (n.get('uploadedBy') or {}).get('name')}
        })
    return jsonify(out)

@app.route('/student_teachers')
def student_teachers():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    if not all([course, year, section]):
        return jsonify({'error': 'Student context missing'}), 400
    admins = get_secondary_admins(course, year, section)
    # Return minimal public info (also include Main Admin)
    out = [{
        'id': 'faculty',
        'name': 'Main Admin',
        'userId': 'faculty',
        'email': '',
        'phone': '',
        'photo': None
    }]
    for a in admins:
        out.append({
            'id': a.get('id'),
            'name': a.get('name'),
            'userId': a.get('userId'),
            'email': a.get('email'),
            'phone': a.get('phone'),
            'photo': a.get('photo'),
            'subjects': a.get('subjects')
        })
    return jsonify(out)

# Student endpoint to list groups for their section (only groups they belong to)
@app.route('/student_groups')
def student_groups():
    if session.get('user_type') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    course = session.get('student_course')
    year = session.get('student_year')
    section = session.get('student_section')
    student = session.get('student_data') or {}
    if not all([course, year, section, student]):
        return jsonify({'error': 'Student context missing'}), 400
    data = load_chat(course, year, section)
    groups = list((data.get('groups') or {}).values())
    # Filter groups where student is a member
    sid = student.get('id')
    out = []
    for g in groups:
        members = g.get('members', [])
        if any(m for m in members if m.get('type') == 'student' and m.get('id') == sid):
            gg = dict(g)
            gg['memberCount'] = len(members)
            out.append(gg)
    return jsonify(out)


# Get a message thread between a student and a teacher for a given section
@app.route('/messages/thread/<course>/<year>/<section>')
def get_message_thread(course, year, section):
    student_id = request.args.get('studentId')
    teacher_id = request.args.get('teacherId')
    if not student_id or not teacher_id:
        return jsonify({'error': 'studentId and teacherId are required'}), 400

    # Authorization: students can only read their own threads; admins can read any in a section
    utype = session.get('user_type')
    if utype == 'student':
        student = session.get('student_data') or {}
        if student.get('id') != student_id:
            return jsonify({'error': 'Unauthorized'}), 401
        # Ensure the section matches student's section
        if not (session.get('student_course') == course and session.get('student_year') == year and session.get('student_section') == section):
            return jsonify({'error': 'Unauthorized'}), 401
    elif utype in {'faculty', 'secondary'}:
        # OK
        pass
    else:
        return jsonify({'error': 'Unauthorized'}), 401

    data = load_messages(course, year, section)
    key = f"{student_id}|{teacher_id}"
    thread = data.get('threads', {}).get(key, [])
    return jsonify(thread)


# Send a message in a thread; supports text and optional file uploads
@app.route('/messages/send/<course>/<year>/<section>', methods=['POST'])
def send_message(course, year, section):
    utype = session.get('user_type')
    if utype not in {'student', 'faculty', 'secondary'}:
        return jsonify({'error': 'Unauthorized'}), 401

    # Accept both JSON and multipart form
    payload = None
    text = None
    student_id = None
    teacher_id = None

    if request.content_type and 'application/json' in request.content_type:
        payload = request.get_json() or {}
        text = (payload.get('text') or '').strip()
        student_id = payload.get('studentId')
        teacher_id = payload.get('teacherId')
        files = []
    else:
        text = (request.form.get('text') or '').strip()
        student_id = request.form.get('studentId')
        teacher_id = request.form.get('teacherId')
        files = request.files.getlist('files') if 'files' in request.files or request.files else []

    if not student_id or not teacher_id:
        return jsonify({'success': False, 'error': 'studentId and teacherId are required'}), 400

    # Authorization checks and context matching
    if utype == 'student':
        student = session.get('student_data') or {}
        if student.get('id') != student_id:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        if not (session.get('student_course') == course and session.get('student_year') == year and session.get('student_section') == section):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        sender = 'student'
    else:
        # faculty or secondary
        if (session.get('user_id') or session.get('userId')) != teacher_id and not (session.get('user_type') == 'faculty' and teacher_id == 'faculty'):
            # For main faculty we allow teacher_id to be 'faculty'
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        sender = 'teacher'

    data = load_messages(course, year, section)
    threads = data.setdefault('threads', {})
    key = f"{student_id}|{teacher_id}"
    thread = threads.setdefault(key, [])

    # Handle file uploads
    atts = []
    if files:
        for f in files:
            if f and f.filename:
                # Save any file type; optionally restrict by ALLOWED_EXTENSIONS if desired
                fn = secure_filename(f.filename)
                ext = fn.rsplit('.', 1)[-1].lower() if '.' in fn else ''
                saved_name = f"msg_{uuid.uuid4().hex}.{ext}" if ext else f"msg_{uuid.uuid4().hex}"
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
                f.save(save_path)
                atts.append({'filename': fn, 'url': url_for('uploaded_file', filename=saved_name)})

    msg = {
        'id': f"msg_{uuid.uuid4().hex[:8]}",
        'from': sender,
        'text': text,
        'attachments': atts,
        'ts': __import__('datetime').datetime.now().isoformat()
    }

    thread.append(msg)
    save_messages(course, year, section, data)

    return jsonify({'success': True, 'message': msg})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

#
