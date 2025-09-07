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

# Call this function when the app starts
initialize_default_data()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# Faculty authentication
@app.route('/faculty_login', methods=['POST'])
def faculty_login():
    data = request.get_json()
    if data.get('userId') == 'faculty' and data.get('password') == 'admin@123':
        session['user_type'] = 'faculty'
        session['user_id'] = 'faculty'
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Invalid credentials'})

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
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401
    
    courses = get_courses()
    return jsonify(courses)

@app.route('/add_course', methods=['POST'])
def add_course():
    if session.get('user_type') != 'faculty':
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
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401

    course_path = os.path.join(DATA_DIR, course_name)
    if os.path.exists(course_path):
        import shutil
        shutil.rmtree(course_path)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Course not found'})

@app.route('/delete_year/<course>/<year_name>')
def delete_year(course, year_name):
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401

    year_path = os.path.join(DATA_DIR, course, year_name)
    if os.path.exists(year_path):
        import shutil
        shutil.rmtree(year_path)
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': 'Year not found'})

@app.route('/delete_section/<course>/<year>/<section_name>')
def delete_section(course, year, section_name):
    if session.get('user_type') != 'faculty':
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
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401
    
    years = get_years(course)
    return jsonify(years)

@app.route('/add_year/<course>', methods=['POST'])
def add_year(course):
    if session.get('user_type') != 'faculty':
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
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401
    
    sections = get_sections(course, year)
    return jsonify(sections)

@app.route('/add_section/<course>/<year>', methods=['POST'])
def add_section(course, year):
    if session.get('user_type') != 'faculty':
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
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': 'Section already exists'})

# Student management
@app.route('/get_students/<course>/<year>/<section>')
def get_students_api(course, year, section):
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        students = get_students(course, year, section)
        return jsonify(students)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add_student/<course>/<year>/<section>', methods=['POST'])
def add_student(course, year, section):
    if session.get('user_type') != 'faculty':
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
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401
    
    students = get_students(course, year, section)
    updated_students = [s for s in students if s['id'] != student_id]
    
    if len(updated_students) == len(students):
        return jsonify({'success': False, 'error': 'Student not found'})
    
    save_students(course, year, section, updated_students)
    return jsonify({'success': True})

# Edit student
@app.route('/edit_student/<course>/<year>/<section>/<student_id>', methods=['PUT'])
def edit_student(course, year, section, student_id):
    if session.get('user_type') != 'faculty':
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
                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"{uuid.uuid4().hex}.{ext}"
                    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    student['photo'] = filename
            break
    
    if not student_found:
        return jsonify({'success': False, 'error': 'Student not found'})
    
    save_students(course, year, section, students)
    return jsonify({'success': True})

# Activity management
@app.route('/get_activities/<course>/<year>/<section>')
def get_activities_api(course, year, section):
    if session.get('user_type') != 'faculty':
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        activities = get_activities(course, year, section)
        return jsonify(activities)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add_activity/<course>/<year>/<section>', methods=['POST'])
def add_activity(course, year, section):
    if session.get('user_type') != 'faculty':
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
    if session.get('user_type') != 'faculty':
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
    if session.get('user_type') != 'faculty':
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
    if session.get('user_type') != 'faculty':
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
        'activities': student_activities
    })

# Serve uploaded files
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)