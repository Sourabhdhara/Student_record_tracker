// Student Track Recorder - Flask-Compatible JavaScript
class StudentTrackRecorder {
    constructor() {
        this.currentUser = null;
        this.currentCourse = null;
        this.currentYear = null;
        this.currentSection = null;
        this.selectedStudent = null;
        
        this.setupEventListeners();
    }

    async apiCall(endpoint, options = {}) {
        try {
            // If options.body is FormData, don't set Content-Type header
            let headers = { ...options.headers };
            if (!(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            } else {
                // If it's FormData, let the browser set the content type with boundary
                delete headers['Content-Type'];
            }

            const response = await fetch(endpoint, {
                headers: headers,
                ...options
            });
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }
            
            if (response.status === 401) {
                this.logout();
                throw new Error('Unauthorized');
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            return data;
        } catch (error) {
            console.error('API call failed:', error);
            this.showError('API Error', error.message || 'Failed to communicate with server');
            throw error;
        }
    }

    setupEventListeners() {
        // Faculty Login Form
        const facultyLoginForm = document.getElementById('facultyLoginForm');
        if (facultyLoginForm) {
            facultyLoginForm.addEventListener('submit', (e) => this.handleFacultyLogin(e));
        }

        // Student Login Form
        const studentLoginForm = document.getElementById('studentLoginForm');
        if (studentLoginForm) {
            studentLoginForm.addEventListener('submit', (e) => this.handleStudentLogin(e));
        }

        // Modal Forms
        this.setupModalForms();
    }

    setupModalForms() {
        // Add Course Form
        const addCourseForm = document.getElementById('addCourseForm');
        if (addCourseForm) {
            addCourseForm.addEventListener('submit', (e) => this.handleAddCourse(e));
        }

        // Add Year Form
        const addYearForm = document.getElementById('addYearForm');
        if (addYearForm) {
            addYearForm.addEventListener('submit', (e) => this.handleAddYear(e));
        }

        // Add Section Form
        const addSectionForm = document.getElementById('addSectionForm');
        if (addSectionForm) {
            addSectionForm.addEventListener('submit', (e) => this.handleAddSection(e));
        }

        // Add Student Form
        const addStudentForm = document.getElementById('addStudentForm');
        if (addStudentForm) {
            addStudentForm.addEventListener('submit', (e) => this.handleAddStudent(e));
        }

        // Add Activity Form
        const addActivityForm = document.getElementById('addActivityForm');
        if (addActivityForm) {
            addActivityForm.addEventListener('submit', (e) => this.handleAddActivity(e));
        }

        // Assign Activity Form
        const assignActivityForm = document.getElementById('assignActivityForm');
        if (assignActivityForm) {
            assignActivityForm.addEventListener('submit', (e) => this.handleAssignActivity(e));
        }

        // Edit Student Form
        const editStudentForm = document.getElementById('editStudentForm');
        if (editStudentForm) {
            editStudentForm.addEventListener('submit', (e) => this.handleEditStudent(e));
        }

        // Edit Activity Form
        const editActivityForm = document.getElementById('editActivityForm');
        if (editActivityForm) {
            editActivityForm.addEventListener('submit', (e) => this.handleEditActivity(e));
        }
    }

    // Navigation Methods
    showLandingPage() {
        this.hideAllPages();
        document.getElementById('landingPage').classList.add('active');
    }

    showFacultyLogin() {
        this.hideAllPages();
        document.getElementById('facultyLoginPage').classList.add('active');
        this.clearErrors();
    }

    showStudentLogin() {
        this.hideAllPages();
        document.getElementById('studentLoginPage').classList.add('active');
        this.clearErrors();
    }

    showFacultyDashboard() {
        this.hideAllPages();
        document.getElementById('facultyDashboard').classList.add('active');
        this.showCourseSelection();
    }

    showStudentDashboard() {
        this.hideAllPages();
        document.getElementById('studentDashboard').classList.add('active');
        this.renderStudentProfile();
    }

    hideAllPages() {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
    }

    // Authentication Methods
    async handleFacultyLogin(e) {
        e.preventDefault();
        const userId = document.getElementById('facultyUserId').value.trim();
        const password = document.getElementById('facultyPassword').value.trim();

        try {
            const result = await this.apiCall('/faculty_login', {
                method: 'POST',
                body: JSON.stringify({ userId, password })
            });
            
            if (result.success) {
                this.currentUser = { type: 'faculty', userId };
                this.showFacultyDashboard();
            } else {
                this.showError('facultyLoginError', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async handleStudentLogin(e) {
        e.preventDefault();
        const rollNumber = document.getElementById('studentRoll').value.trim();
        const email = document.getElementById('studentEmail').value.trim();
        const password = document.getElementById('studentPassword').value.trim();

        try {
            const result = await this.apiCall('/student_login', {
                method: 'POST',
                body: JSON.stringify({ rollNumber, email, password })
            });
            
            if (result.success) {
                this.showStudentDashboard();
            } else {
                this.showError('studentLoginError', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
            this.showError('studentLoginError', 'Login failed. Please check your credentials.');
        }
    }

    logout() {
        // Call the server logout endpoint
        fetch('/logout')
            .then(() => {
                this.currentUser = null;
                this.currentCourse = null;
                this.currentYear = null;
                this.currentSection = null;
                this.showLandingPage();
            })
            .catch(error => {
                console.error('Logout error:', error);
            });
    }

    // Course Management
    async showCourseSelection() {
        this.hideAllSections();
        document.getElementById('courseSelection').classList.add('active');
        await this.renderCourses();
    }

    async renderCourses() {
        try {
            const courses = await this.apiCall('/get_courses');
            const container = document.getElementById('coursesList');
            container.innerHTML = '';

            courses.forEach(course => {
                const courseCard = document.createElement('div');
                courseCard.className = 'card';
                courseCard.onclick = () => this.selectCourse(course);

                courseCard.innerHTML = `
                    <div class="card-actions">
                        <button class="action-btn delete-btn" onclick="event.stopPropagation(); app.deleteCourse('${course}')">Delete</button>
                    </div>
                    <h3>${course}</h3>
                    <p>Click to manage years and sections</p>
                `;

                container.appendChild(courseCard);
            });
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    selectCourse(course) {
        this.currentCourse = course;
        this.showYearSelection();
    }

    async handleAddCourse(e) {
        e.preventDefault();
        const courseName = document.getElementById('courseName').value.trim();

        try {
            const result = await this.apiCall('/add_course', {
                method: 'POST',
                body: JSON.stringify({ name: courseName })
            });
            
            if (result.success) {
                await this.renderCourses();
                this.closeModal('addCourseModal');
                this.showSuccess('Course added successfully!');
            } else {
                this.showError('Add Course Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async deleteCourse(courseName) {
        if (confirm('Are you sure you want to delete this course? This will also delete all related years, sections, students, and activities.')) {
            try {
                const result = await this.apiCall(`/delete_course/${encodeURIComponent(courseName)}`);
                
                if (result.success) {
                    await this.renderCourses();
                    this.showSuccess('Course deleted successfully!');
                } else {
                    this.showError('Delete Course Error', result.error);
                }
            } catch (error) {
                // Error handling already done in apiCall
            }
        }
    }

    // Year Management
    async showYearSelection() {
        this.hideAllSections();
        document.getElementById('yearSelection').classList.add('active');
        document.getElementById('yearSectionTitle').textContent = `${this.currentCourse} - Select Year`;
        await this.renderYears();
    }

    async renderYears() {
        try {
            const years = await this.apiCall(`/get_years/${encodeURIComponent(this.currentCourse)}`);
            const container = document.getElementById('yearsList');
            container.innerHTML = '';

            years.forEach(year => {
                const yearCard = document.createElement('div');
                yearCard.className = 'card';
                yearCard.onclick = () => this.selectYear(year);

                yearCard.innerHTML = `
                    <div class="card-actions">
                        <button class="action-btn delete-btn" onclick="event.stopPropagation(); app.deleteYear('${year}')">Delete</button>
                    </div>
                    <h3>${year}</h3>
                    <p>Click to manage sections</p>
                `;

                container.appendChild(yearCard);
            });
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    selectYear(year) {
        this.currentYear = year;
        this.showSectionSelection();
    }

    async handleAddYear(e) {
        e.preventDefault();
        const yearName = document.getElementById('yearName').value.trim();

        try {
            const result = await this.apiCall(`/add_year/${encodeURIComponent(this.currentCourse)}`, {
                method: 'POST',
                body: JSON.stringify({ name: yearName })
            });
            
            if (result.success) {
                await this.renderYears();
                this.closeModal('addYearModal');
                this.showSuccess('Year added successfully!');
            } else {
                this.showError('Add Year Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async deleteYear(yearName) {
        if (confirm('Are you sure you want to delete this year? This will also delete all related sections, students, and activities.')) {
            try {
                const result = await this.apiCall(`/delete_year/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(yearName)}`);

                if (result.success) {
                    await this.renderYears();
                    this.showSuccess('Year deleted successfully!');
                } else {
                    this.showError('Delete Year Error', result.error);
                }
            } catch (error) {
                // Error handling already done in apiCall
            }
        }
    }

    // Section Management
    async showSectionSelection() {
        this.hideAllSections();
        document.getElementById('sectionSelection').classList.add('active');
        document.getElementById('sectionSectionTitle').textContent = `${this.currentCourse} ${this.currentYear} - Select Section`;
        await this.renderSections();
    }

    async renderSections() {
        try {
            const sections = await this.apiCall(`/get_sections/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}`);
            const container = document.getElementById('sectionsList');
            container.innerHTML = '';

            sections.forEach(section => {
                const sectionCard = document.createElement('div');
                sectionCard.className = 'card';
                sectionCard.onclick = () => this.selectSection(section);

                sectionCard.innerHTML = `
                    <div class="card-actions">
                        <button class="action-btn delete-btn" onclick="event.stopPropagation(); app.deleteSection('${section}')">Delete</button>
                    </div>
                    <h3>${section}</h3>
                    <p>Click to view students and activities</p>
                `;

                container.appendChild(sectionCard);
            });
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    selectSection(section) {
        this.currentSection = section;
        this.showStudentsActivities();
    }

    async handleAddSection(e) {
        e.preventDefault();
        const sectionName = document.getElementById('sectionName').value.trim();

        try {
            const result = await this.apiCall(`/add_section/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}`, {
                method: 'POST',
                body: JSON.stringify({ name: sectionName })
            });
            
            if (result.success) {
                await this.renderSections();
                this.closeModal('addSectionModal');
                this.showSuccess('Section added successfully!');
            } else {
                this.showError('Add Section Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async deleteSection(sectionName) {
        if (confirm('Are you sure you want to delete this section? This will also delete all students and activities in this section.')) {
            try {
                const result = await this.apiCall(`/delete_section/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(sectionName)}`);

                if (result.success) {
                    await this.renderSections();
                    this.showSuccess('Section deleted successfully!');
                } else {
                    this.showError('Delete Section Error', result.error);
                }
            } catch (error) {
                // Error handling already done in apiCall
            }
        }
    }

    // Students & Activities Management
    async showStudentsActivities() {
        this.hideAllSections();
        document.getElementById('studentsActivities').classList.add('active');
        document.getElementById('studentsActivitiesTitle').textContent = `${this.currentCourse} > ${this.currentYear} > ${this.currentSection}`;
        this.switchTab('students');
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabName + 'Tab').classList.add('active');

        if (tabName === 'students') {
            this.renderStudents();
        } else if (tabName === 'activities') {
            this.renderActivities();
        }
    }

    async renderStudents() {
        try {
            const students = await this.apiCall(`/get_students/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            const container = document.getElementById('studentsList');
            container.innerHTML = '';

            if (students.length === 0) {
                container.innerHTML = '<div class="item"><p>No students added yet. Click "Add Student" to get started.</p></div>';
                return;
            }

            students.forEach(student => {
                const studentItem = document.createElement('div');
                studentItem.className = 'item';

                studentItem.innerHTML = `
                    <div class="item-info">
                        <h4>${student.name}</h4>
                        <p>Roll: ${student.rollNumber} | Email: ${student.email}</p>
                        <p>Father: ${student.fatherName} (${student.fatherPhone})</p>
                        <p>Mother: ${student.motherName} (${student.motherPhone})</p>
                    </div>
                    <div class="item-actions">
                        <button class="assign-btn" onclick="app.showAssignActivityModal('${student.id}')">Assign Activities</button>
                        <button class="edit-btn" onclick="app.editStudent('${student.id}')">Edit</button>
                        <button class="delete-item-btn" onclick="app.deleteStudent('${student.id}')">Delete</button>
                    </div>
                `;

                container.appendChild(studentItem);
            });
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async handleAddStudent(e) {
        e.preventDefault();

        // Create FormData object to handle file upload
        const formData = new FormData();
        formData.append('name', document.getElementById('studentName').value.trim());
        formData.append('rollNumber', document.getElementById('studentRollNo').value.trim());
        formData.append('email', document.getElementById('studentEmailId').value.trim());
        formData.append('phone', document.getElementById('studentPhone').value.trim());
        formData.append('fatherName', document.getElementById('fatherName').value.trim());
        formData.append('fatherPhone', document.getElementById('fatherPhone').value.trim());
        formData.append('motherName', document.getElementById('motherName').value.trim());
        formData.append('motherPhone', document.getElementById('motherPhone').value.trim());
        formData.append('secretPassword', document.getElementById('studentSecretPassword').value.trim());
        formData.append('createdAt', new Date().toISOString());

        // Add photo file if selected
        const photoFile = document.getElementById('studentPhoto').files[0];
        if (photoFile) {
            formData.append('studentPhoto', photoFile);
        }

        try {
            const result = await this.apiCall(`/add_student/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`, {
                method: 'POST',
                body: formData,
                // Don't set Content-Type header when using FormData
                headers: {}
            });
            
            if (result.success) {
                await this.renderStudents();
                this.closeModal('addStudentModal');
                this.showSuccess('Student added successfully!');
            } else {
                this.showError('Add Student Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async deleteStudent(studentId) {
        if (confirm('Are you sure you want to delete this student?')) {
            try {
                const result = await this.apiCall(`/delete_student/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(studentId)}`, {
                    method: 'DELETE'
                });

                if (result.success) {
                    await this.renderStudents();
                    this.showSuccess('Student deleted successfully!');
                } else {
                    this.showError('Delete Student Error', result.error);
                }
            } catch (error) {
                // Error handling already done in apiCall
            }
        }
    }

    async editStudent(studentId) {
        try {
            const students = await this.apiCall(`/get_students/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            const student = students.find(s => s.id === studentId);
            
            if (!student) {
                this.showError('Edit Student Error', 'Student not found');
                return;
            }

            // Pre-fill the edit form
            document.getElementById('editStudentName').value = student.name || '';
            document.getElementById('editStudentRollNo').value = student.rollNumber || '';
            document.getElementById('editStudentEmailId').value = student.email || '';
            document.getElementById('editStudentPhone').value = student.phone || '';
            document.getElementById('editFatherName').value = student.fatherName || '';
            document.getElementById('editFatherPhone').value = student.fatherPhone || '';
            document.getElementById('editMotherName').value = student.motherName || '';
            document.getElementById('editMotherPhone').value = student.motherPhone || '';
            document.getElementById('editStudentSecretPassword').value = student.secretPassword || '';
            
            // Store student ID for form submission
            document.getElementById('editStudentForm').dataset.studentId = studentId;
            
            this.showModal('editStudentModal');
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async handleEditStudent(e) {
        e.preventDefault();
        const studentId = e.target.dataset.studentId;

        // Create FormData object to handle file upload
        const formData = new FormData();
        formData.append('name', document.getElementById('editStudentName').value.trim());
        formData.append('rollNumber', document.getElementById('editStudentRollNo').value.trim());
        formData.append('email', document.getElementById('editStudentEmailId').value.trim());
        formData.append('phone', document.getElementById('editStudentPhone').value.trim());
        formData.append('fatherName', document.getElementById('editFatherName').value.trim());
        formData.append('fatherPhone', document.getElementById('editFatherPhone').value.trim());
        formData.append('motherName', document.getElementById('editMotherName').value.trim());
        formData.append('motherPhone', document.getElementById('editMotherPhone').value.trim());
        formData.append('secretPassword', document.getElementById('editStudentSecretPassword').value.trim());

        // Add photo file if selected
        const photoFile = document.getElementById('editStudentPhoto').files[0];
        if (photoFile) {
            formData.append('studentPhoto', photoFile);
        }

        try {
            const result = await this.apiCall(`/edit_student/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(studentId)}`, {
                method: 'PUT',
                body: formData,
                headers: {}
            });
            
            if (result.success) {
                await this.renderStudents();
                this.closeModal('editStudentModal');
                this.showSuccess('Student updated successfully!');
            } else {
                this.showError('Edit Student Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async renderActivities() {
        try {
            const activities = await this.apiCall(`/get_activities/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            const container = document.getElementById('activitiesList');
            container.innerHTML = '';

            if (activities.length === 0) {
                container.innerHTML = '<div class="item"><p>No activities added yet. Click "Add Activity" to get started.</p></div>';
                return;
            }

            activities.forEach(activity => {
                const activityItem = document.createElement('div');
                activityItem.className = 'item';

                activityItem.innerHTML = `
                    <div class="item-info">
                        <h4>${activity.name}</h4>
                        <p>${activity.details}</p>
                        <p><small>Created: ${new Date(activity.createdAt).toLocaleDateString()}</small></p>
                    </div>
                    <div class="item-actions">
                        <button class="edit-btn" onclick="app.editActivity('${activity.id}')">Edit</button>
                        <button class="delete-item-btn" onclick="app.deleteActivity('${activity.id}')">Delete</button>
                    </div>
                `;

                container.appendChild(activityItem);
            });
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async handleAddActivity(e) {
        e.preventDefault();

        const activityData = {
            name: document.getElementById('activityName').value.trim(),
            details: document.getElementById('activityDetails').value.trim(),
            createdAt: new Date().toISOString()
        };

        try {
            const result = await this.apiCall(`/add_activity/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`, {
                method: 'POST',
                body: JSON.stringify(activityData)
            });
            
            if (result.success) {
                await this.renderActivities();
                this.closeModal('addActivityModal');
                this.showSuccess('Activity added successfully!');
            } else {
                this.showError('Add Activity Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async deleteActivity(activityId) {
        if (confirm('Are you sure you want to delete this activity?')) {
            try {
                const result = await this.apiCall(`/delete_activity/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(activityId)}`, {
                    method: 'DELETE'
                });

                if (result.success) {
                    await this.renderActivities();
                    this.showSuccess('Activity deleted successfully!');
                } else {
                    this.showError('Delete Activity Error', result.error);
                }
            } catch (error) {
                // Error handling already done in apiCall
            }
        }
    }

    async editActivity(activityId) {
        try {
            const activities = await this.apiCall(`/get_activities/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            const activity = activities.find(a => a.id === activityId);
            
            if (!activity) {
                this.showError('Edit Activity Error', 'Activity not found');
                return;
            }

            // Pre-fill the edit form
            document.getElementById('editActivityName').value = activity.name || '';
            document.getElementById('editActivityDetails').value = activity.details || '';
            
            // Store activity ID for form submission
            document.getElementById('editActivityForm').dataset.activityId = activityId;
            
            this.showModal('editActivityModal');
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async handleEditActivity(e) {
        e.preventDefault();
        const activityId = e.target.dataset.activityId;

        const activityData = {
            name: document.getElementById('editActivityName').value.trim(),
            details: document.getElementById('editActivityDetails').value.trim()
        };

        try {
            const result = await this.apiCall(`/edit_activity/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(activityId)}`, {
                method: 'PUT',
                body: JSON.stringify(activityData)
            });
            
            if (result.success) {
                await this.renderActivities();
                this.closeModal('editActivityModal');
                this.showSuccess('Activity updated successfully!');
            } else {
                this.showError('Edit Activity Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    // Activity Assignment
    async showAssignActivityModal(studentId) {
        try {
            const students = await this.apiCall(`/get_students/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            this.selectedStudent = students.find(s => s.id === studentId);
            
            const activities = await this.apiCall(`/get_activities/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            const checkboxContainer = document.getElementById('activitiesCheckboxes');

            checkboxContainer.innerHTML = '';

            activities.forEach(activity => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.innerHTML = `
                    <label>
                        <input type="checkbox" value="${activity.id}" ${this.selectedStudent.assignedActivities.includes(activity.id) ? 'checked' : ''}>
                        ${activity.name}
                    </label>
                `;
                checkboxContainer.appendChild(checkboxDiv);
            });

            this.showModal('assignActivityModal');
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    async handleAssignActivity(e) {
        e.preventDefault();

        const selectedActivities = [];
        document.querySelectorAll('#activitiesCheckboxes input:checked').forEach(checkbox => {
            selectedActivities.push(checkbox.value);
        });

        const remarks = document.getElementById('studentRemarks').value;

        try {
            const result = await this.apiCall(`/assign_activities/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${this.selectedStudent.id}`, {
                method: 'POST',
                body: JSON.stringify({ activities: selectedActivities, remarks })
            });
            
            if (result.success) {
                await this.renderStudents();
                this.closeModal('assignActivityModal');
                this.showSuccess('Activities assigned successfully!');
            } else {
                this.showError('Assign Activity Error', result.error);
            }
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    // Student Dashboard
    async renderStudentProfile() {
        try {
            const data = await this.apiCall('/student_data');
            const student = data.student;
            
            // Create photo HTML - either display uploaded image or initials
            let photoHTML = '';
            if (student.photo) {
                photoHTML = `<img src="/uploads/${student.photo}" alt="${student.name}" class="student-photo">`;
            } else {
                photoHTML = `<div class="student-photo" style="width: 80px; height: 80px; background: #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem;">
                    ${student.name.charAt(0)}
                </div>`;
            }
            
            const profileContainer = document.getElementById('studentProfile');
            profileContainer.innerHTML = `
                <div class="student-header">
                    ${photoHTML}
                    <div class="student-info">
                        <h2>${student.name}</h2>
                        <p>Roll Number: ${student.rollNumber}</p>
                        <p>Email: ${student.email}</p>
                    </div>
                </div>

                <div class="student-details">
                    <div class="detail-item">
                        <strong>Phone:</strong> ${student.phone}
                    </div>
                    <div class="detail-item">
                        <strong>Father:</strong> ${student.fatherName} (${student.fatherPhone})
                    </div>
                    <div class="detail-item">
                        <strong>Mother:</strong> ${student.motherName} (${student.motherPhone})
                    </div>
                </div>
            `;

            this.renderStudentActivities(data.activities);
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    renderStudentActivities(activities) {
        const activitiesContainer = document.getElementById('studentActivities');
        activitiesContainer.innerHTML = '<h3>My Activities</h3>';

        if (activities.length === 0) {
            activitiesContainer.innerHTML += '<p>No activities assigned yet.</p>';
            return;
        }

        activities.forEach(activity => {
            const activityDiv = document.createElement('div');
            activityDiv.className = 'activity-item';

            activityDiv.innerHTML = `
                <div class="activity-header">
                    <h4 class="activity-title">${activity.name}</h4>
                    <span class="status-badge">${activity.status}</span>
                </div>
                <p>${activity.details}</p>
                <p><small>Assigned: ${new Date(activity.assignedAt || activity.createdAt).toLocaleDateString()}</small></p>
            `;

            activitiesContainer.appendChild(activityDiv);
        });
    }

    // Navigation helpers
    backToCourses() {
        this.currentCourse = null;
        this.currentYear = null;
        this.currentSection = null;
        this.showCourseSelection();
    }

    backToYears() {
        this.currentYear = null;
        this.currentSection = null;
        this.showYearSelection();
    }

    backToSections() {
        this.currentSection = null;
        this.showSectionSelection();
    }

    hideAllSections() {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
    }

    // Modal Management
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        // Clear form data
        const modal = document.getElementById(modalId);
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }

    // Utility Methods
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
            setTimeout(() => {
                errorElement.classList.remove('show');
            }, 5000);
        } else {
            // Fallback alert for errors without specific elements
            alert(`Error: ${message}`);
        }
    }

    clearErrors() {
        document.querySelectorAll('.error-message').forEach(error => {
            error.classList.remove('show');
            error.textContent = '';
        });
    }

    showSuccess(message) {
        // Create and show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);

        setTimeout(() => {
            if (document.body.contains(successDiv)) {
                document.body.removeChild(successDiv);
            }
        }, 3000);
    }
}

// Initialize the application
const app = new StudentTrackRecorder();

// Global functions for HTML onclick events
function showFacultyLogin() { app.showFacultyLogin(); }
function showStudentLogin() { app.showStudentLogin(); }
function showLandingPage() { app.showLandingPage(); }
function logout() { app.logout(); }
function backToCourses() { app.backToCourses(); }
function backToYears() { app.backToYears(); }
function backToSections() { app.backToSections(); }
function switchTab(tabName) { app.switchTab(tabName); }

// Modal functions
function showAddCourseModal() { app.showModal('addCourseModal'); }
function showAddYearModal() { app.showModal('addYearModal'); }
function showAddSectionModal() { app.showModal('addSectionModal'); }
function showAddStudentModal() { app.showModal('addStudentModal'); }
function showAddActivityModal() { app.showModal('addActivityModal'); }
function closeModal(modalId) { app.closeModal(modalId); }

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        const modalId = e.target.id;
        app.closeModal(modalId);
    }
});