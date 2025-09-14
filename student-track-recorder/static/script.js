// Student Track Recorder - Flask-Compatible JavaScript
class StudentTrackRecorder {
    constructor() {
        this.currentUser = null;
        this.currentCourse = null;
        this.currentYear = null;
        this.currentSection = null;
        this.selectedStudent = null;
        // Student attendance calendar state
        this.studentViewYear = null;
        this.studentViewMonth = null;
        this.studentAttendanceDates = new Set();
        
        this.setupEventListeners();
        // History handling for Back/Forward navigation
        window.addEventListener('popstate', (e) => {
            if (e.state) this._applyState(e.state);
            else this.showLandingPage(true);
        });
        // Initialize initial state if empty
        if (!history.state) {
            // Detect current active page
            let page = 'landing';
            if (document.getElementById('facultyLoginPage')?.classList.contains('active')) page = 'facultyLogin';
            else if (document.getElementById('studentLoginPage')?.classList.contains('active')) page = 'studentLogin';
            else if (document.getElementById('facultyDashboard')?.classList.contains('active')) page = 'facultyDashboard';
            else if (document.getElementById('studentDashboard')?.classList.contains('active')) page = 'studentDashboard';
            history.replaceState({ page }, '');
        }
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

    // Push a new navigation state into history
    _push(page, payload = {}) {
        try {
            if (this._suppressPush) return;
            const state = { page, ...payload };
            history.pushState(state, '');
        } catch (e) {}
    }

    // Apply a navigation state (used on popstate)
    _applyState(state) {
        this._suppressPush = true;
        try {
            switch (state.page) {
                case 'facultyLogin':
                    this.showFacultyLogin(true);
                    break;
                case 'studentLogin':
                    this.showStudentLogin(true);
                    break;
                case 'facultyDashboard':
                    this.showFacultyDashboard(true);
                    // Step within the dashboard
                    this.currentCourse = state.course || null;
                    this.currentYear = state.year || null;
                    this.currentSection = state.section || null;
                    switch (state.step) {
                        case 'year':
                            this.showYearSelection(true);
                            break;
                        case 'section':
                            this.showSectionSelection(true);
                            break;
                        case 'students':
                            this.showStudentsActivities(true);
                            break;
                        default:
                            this.showCourseSelection(true);
                    }
                    break;
                case 'studentDashboard':
                    this.showStudentDashboard(true);
                    break;
                default:
                    this.showLandingPage(true);
            }
        } finally {
            this._suppressPush = false;
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
        // Add Certificate Form
        const addCertificateForm = document.getElementById('addCertificateForm');
        if (addCertificateForm) {
            addCertificateForm.addEventListener('submit', (e) => this.handleAddCertificate(e));
        }
    }

    // Navigation Methods
    showLandingPage(noPush = false) {
        this.hideAllPages();
        document.getElementById('landingPage').classList.add('active');
        if (!noPush) this._push('landing');
    }

    showFacultyLogin(noPush = false) {
        this.hideAllPages();
        document.getElementById('facultyLoginPage').classList.add('active');
        this.clearErrors();
        if (!noPush) this._push('facultyLogin');
    }

    showStudentLogin(noPush = false) {
        this.hideAllPages();
        document.getElementById('studentLoginPage').classList.add('active');
        this.clearErrors();
        if (!noPush) this._push('studentLogin');
    }

    showFacultyDashboard(noPush = false) {
        this.hideAllPages();
        document.getElementById('facultyDashboard').classList.add('active');
        const secTabBtn = document.getElementById('secondaryAdminTabBtn');
        const addSecBtn = document.getElementById('addSecondaryAdminBtn');
        if (secTabBtn) secTabBtn.style.display = (this.currentUser?.type === 'faculty') ? '' : 'none';
        if (addSecBtn) addSecBtn.style.display = (this.currentUser?.type === 'faculty') ? '' : 'none';
        if (!noPush) this._push('facultyDashboard', { step: 'course' });
        this.showCourseSelection(true);
    }

    showStudentDashboard(noPush = false) {
        this.hideAllPages();
        document.getElementById('studentDashboard').classList.add('active');
        if (!noPush) this._push('studentDashboard');
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
        const accountType = (document.getElementById('facultyAccountType')?.value || 'main');

        try {
            const result = await this.apiCall('/faculty_login', {
                method: 'POST',
                body: JSON.stringify({ userId, password, accountType })
            });
            
            if (result.success) {
                const role = result.role || (accountType === 'secondary' ? 'secondary' : 'faculty');
                this.currentUser = { type: role === 'secondary' ? 'secondary' : 'faculty', userId };
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
    async showCourseSelection(noPush = false) {
        this.hideAllSections();
        document.getElementById('courseSelection').classList.add('active');
        if (!noPush) this._push('facultyDashboard', { step: 'course' });
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
    async showYearSelection(noPush = false) {
        this.hideAllSections();
        document.getElementById('yearSelection').classList.add('active');
        document.getElementById('yearSectionTitle').textContent = `${this.currentCourse} - Select Year`;
        if (!noPush) this._push('facultyDashboard', { step: 'year', course: this.currentCourse });
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
    async showSectionSelection(noPush = false) {
        this.hideAllSections();
        document.getElementById('sectionSelection').classList.add('active');
        document.getElementById('sectionSectionTitle').textContent = `${this.currentCourse} ${this.currentYear} - Select Section`;
        if (!noPush) this._push('facultyDashboard', { step: 'section', course: this.currentCourse, year: this.currentYear });
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
    async showStudentsActivities(noPush = false) {
        this.hideAllSections();
        document.getElementById('studentsActivities').classList.add('active');
        document.getElementById('studentsActivitiesTitle').textContent = `${this.currentCourse} > ${this.currentYear} > ${this.currentSection}`;
        if (!noPush) this._push('facultyDashboard', { step: 'students', course: this.currentCourse, year: this.currentYear, section: this.currentSection });
        this.switchTab('students');
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
        if (btn) btn.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const tabEl = document.getElementById(tabName + 'Tab');
        if (tabEl) tabEl.classList.add('active');

        if (tabName === 'students') {
            this.renderStudents();
        } else if (tabName === 'activities') {
            this.renderActivities();
        } else if (tabName === 'secondaryAdmins') {
            this.renderSecondaryAdmins();
        } else if (tabName === 'messages') {
            this.renderMessagesTab();
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
                        <button class="add-btn" onclick="app.openAddCertificateModal('${student.id}')">Certificates</button>
                        <button class="add-btn" onclick="app.openTeacherChatToStudent('${student.id}')">Message</button>
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

    // Certificates management (admin) and student viewing
    async openAddCertificateModal(studentId) {
        try {
            const students = await this.apiCall(`/get_students/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            this.selectedStudent = students.find(s => s.id === studentId) || { id: studentId };
        } catch (e) {
            this.selectedStudent = { id: studentId };
        }
        const form = document.getElementById('addCertificateForm');
        if (form) form.dataset.studentId = studentId;
        const nameInput = document.getElementById('certificateName');
        const fileInput = document.getElementById('certificateFile');
        if (nameInput) nameInput.value = '';
        if (fileInput) fileInput.value = '';
        await this.renderCertificatesListForStudent(studentId);
        this.showModal('addCertificateModal');
    }

    async renderCertificatesListForStudent(studentId) {
        const list = document.getElementById('certificatesListForStudent');
        if (!list) return;
        list.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const res = await this.apiCall(`/certificates/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}?studentId=${encodeURIComponent(studentId)}`);
            list.innerHTML = '';
            if (!res || !res.length) {
                list.innerHTML = '<div class="item"><p class="muted">No certificates yet.</p></div>';
                return;
            }
            res.forEach(c => {
                const div = document.createElement('div');
                div.className = 'item';
                const fn = this.escapeHtml(c.filename || c.name || 'file');
                const uploaded = c.uploadedAt ? new Date(c.uploadedAt).toLocaleString() : '';
                const by = (c.uploadedBy && c.uploadedBy.name) ? ` by ${this.escapeHtml(c.uploadedBy.name)}` : '';
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${this.escapeHtml(c.name || '')}</h4>
                        <p class="muted">${fn}</p>
                        <p><small>Uploaded ${uploaded}${by}</small></p>
                    </div>
                    <div class="item-actions">
                        <button class="delete-item-btn" onclick="app.deleteCertificate('${studentId}', '${c.id}')">Remove</button>
                        <a class="add-btn" href="${c.url}" target="_blank">Download</a>
                    </div>
                `;
                list.appendChild(div);
            });
        } catch (e) {
            list.innerHTML = '<div class="item"><p class="muted">Failed to load certificates.</p></div>';
        }
    }

    async handleAddCertificate(e) {
        e.preventDefault();
        if (!this.currentCourse || !this.currentYear || !this.currentSection) {
            alert('Select course/year/section first.');
            return;
        }
        const form = e.target;
        const studentId = form.dataset.studentId || (this.selectedStudent && this.selectedStudent.id);
        const name = document.getElementById('certificateName').value.trim();
        const fileInput = document.getElementById('certificateFile');
        const file = fileInput ? fileInput.files[0] : null;
        if (!studentId || !name || !file) {
            alert('Student, name and file are required.');
            return;
        }
        const fd = new FormData();
        fd.append('studentId', studentId);
        fd.append('name', name);
        fd.append('certFile', file);
        try {
            const res = await this.apiCall(`/certificates/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`, {
                method: 'POST',
                body: fd,
                headers: {}
            });
            if (res && res.success) {
                this.showSuccess('Certificate uploaded.');
                await this.renderCertificatesListForStudent(studentId);
                form.reset();
            }
        } catch (e) {}
    }

    async deleteCertificate(studentId, certId) {
        if (!this.currentCourse || !this.currentYear || !this.currentSection) return;
        if (!confirm('Delete this certificate?')) return;
        try {
            const res = await this.apiCall(`/certificates/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(certId)}?studentId=${encodeURIComponent(studentId)}`, { method: 'DELETE' });
            if (res && res.success) {
                this.showSuccess('Certificate deleted.');
                await this.renderCertificatesListForStudent(studentId);
            } else {
                this.showError('Delete Certificate Error', (res && res.error) || 'Failed to delete.');
            }
        } catch (e) {}
    }

    async renderStudentCertificates() {
        const cont = document.getElementById('studentCertificates');
        if (!cont) return;
        cont.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <h3 style="margin:0;flex:1 1 auto;">My Certificates</h3>
                <div class="form-actions" style="gap:8px;flex-wrap:wrap;justify-content:flex-start;border-top:none;margin-top:0;padding-top:0;flex:1 1 100%;">
                    <button class="add-btn" style="width:auto;padding:8px 14px;font-size:0.9rem;" onclick="app.openStudentCertificates()">View</button>
                    <button class="add-btn" style="width:auto;padding:8px 14px;font-size:0.9rem;" onclick="app.openStudentScrutiny()">Upload to Verify</button>
                    <button class="add-btn" style="width:auto;padding:8px 14px;font-size:0.9rem;" onclick="app.openStudentScrutinyStatus()">Status</button>
                </div>
            </div>
        `;
        try {
            const list = await this.apiCall('/student_certificates');
            const count = Array.isArray(list) ? list.length : 0;
            if (!count) {
                cont.innerHTML += '<p class="muted">No certificates uploaded yet.</p>';
            } else {
                cont.innerHTML += `<p class="muted">Certificates: ${count}</p>`;
            }
        } catch (e) {}
    }

    // Student scrutiny (verification) UI
    openStudentScrutiny() {
        const form = document.getElementById('studentScrutinyForm');
        if (form && !form._bound) {
            form.addEventListener('submit', (e) => this.handleStudentScrutinySubmit(e));
            form._bound = true;
        }
        this.showModal('studentScrutinyModal');
    }

    async handleStudentScrutinySubmit(e) {
        e.preventDefault();
        const file = document.getElementById('scrutinyFile').files[0];
        const description = document.getElementById('scrutinyDescription').value.trim();
        if (!file || !description) { alert('Please attach a file and provide description.'); return; }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('description', description);
        try {
            const res = await this.apiCall('/scrutiny/student_submit', { method: 'POST', body: fd, headers: {} });
            if (res && res.success) {
                this.closeModal('studentScrutinyModal');
                this.showSuccess('Sent to faculty for verification.');
            }
        } catch (e) {}
    }

    openStudentScrutinyStatus() {
        this.showModal('studentScrutinyStatusModal');
        this.renderStudentScrutinyList();
    }

    async renderStudentScrutinyList() {
        const list = document.getElementById('studentScrutinyList');
        if (!list) return;
        list.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const reqs = await this.apiCall('/student_scrutiny');
            list.innerHTML = '';
            if (!reqs || !reqs.length) { list.innerHTML = '<div class="item"><p class="muted">No submissions yet.</p></div>'; return; }
            reqs.slice().sort((a,b) => (a.submittedAt||'').localeCompare(b.submittedAt||'')).forEach(r => {
                const div = document.createElement('div');
                div.className = 'item';
                const status = this.escapeHtml(r.status || 'pending');
                const remark = this.escapeHtml(r.remark || '');
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${this.escapeHtml(r.description || '')}</h4>
                        <p class="muted">File: <a href="${r.file?.url}" target="_blank">${this.escapeHtml(r.file?.filename || 'download')}</a></p>
                        ${remark ? `<p><strong>Remark:</strong> ${remark}</p>` : ''}
                        <p><small>Submitted: ${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''}</small></p>
                    </div>
                    <div class="item-actions">
                        <button class="delete-item-btn" data-id="${this.escapeHtml(r.id)}">Delete</button>
                    </div>
                `;
                const delBtn = div.querySelector('button.delete-item-btn');
                if (delBtn) delBtn.onclick = () => this.deleteStudentScrutiny(r.id);
                list.appendChild(div);
            });
        } catch (e) {
            list.innerHTML = '<div class="item"><p class="muted">Failed to load.</p></div>';
        }
    }

    async deleteStudentScrutiny(id) {
        if (!confirm('Delete this verification submission?')) return;
        try {
            const res = await this.apiCall(`/scrutiny/student/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (res && res.success) {
                this.showSuccess('Submission deleted.');
                await this.renderStudentScrutinyList();
            }
        } catch (e) {}
    }

    // Faculty scrutiny manager
    async openScrutinyManager() {
        if (!this.currentCourse || !this.currentYear || !this.currentSection) { alert('Select course/year/section first.'); return; }
        this.showModal('scrutinyModal');
        await this.renderScrutinyList();
    }

    async renderScrutinyList() {
        const list = document.getElementById('scrutinyList');
        if (!list) return;
        list.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const reqs = await this.apiCall(`/scrutiny/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            list.innerHTML = '';
            if (!reqs || !reqs.length) { list.innerHTML = '<div class="item"><p class="muted">Nothing to verify.</p></div>'; return; }
            reqs.slice().sort((a,b) => (a.submittedAt||'').localeCompare(b.submittedAt||'')).forEach(r => {
                const div = document.createElement('div');
                div.className = 'item';
                const status = this.escapeHtml(r.status || 'pending');
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${this.escapeHtml(r.studentName || r.studentId || '')} <span class="status-badge" style="margin-left:8px;">${status}</span></h4>
                        <p>${this.escapeHtml(r.description || '')}</p>
                        <p class="muted">File: <a href="${r.file?.url}" target="_blank">${this.escapeHtml(r.file?.filename || 'download')}</a></p>
                        ${r.remark ? `<p><strong>Remark:</strong> ${this.escapeHtml(r.remark)}</p>` : ''}
                        <div class="form-actions" style="gap:8px;">
                            <select id="remarkStatus_${r.id}">
                                <option value="Pending" ${status==='Pending'? 'selected':''}>Pending</option>
                                <option value="Under Process" ${status==='Under Process'? 'selected':''}>Under Process</option>
                                <option value="Non Verified Doc" ${status==='Non Verified Doc'? 'selected':''}>Non Verified Doc</option>
                                <option value="Verified" ${status==='Verified'? 'selected':''}>Verified</option>
                                <option value="rejected" ${status==='rejected'? 'selected':''}>rejected</option>
                            </select>
                            <input id="remarkText_${r.id}" placeholder="Add remark" style="flex:1;padding:6px;" />
                            <button class="submit-btn">Save Remark</button>
                        </div>
                        <p><small>Submitted: ${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''}</small></p>
                    </div>
                `;
                const btn = div.querySelector('button');
                btn.onclick = () => this.saveScrutinyRemark(r.id);
                list.appendChild(div);
            });
        } catch (e) {
            list.innerHTML = '<div class="item"><p class="muted">Failed to load.</p></div>';
        }
    }

    async saveScrutinyRemark(id) {
        const statusEl = document.getElementById(`remarkStatus_${id}`);
        const remarkEl = document.getElementById(`remarkText_${id}`);
        const status = statusEl ? statusEl.value : 'verified';
        const remark = remarkEl ? remarkEl.value.trim() : '';
        try {
            const res = await this.apiCall(`/scrutiny/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify({ status, remark })
            });
            if (res && res.success) {
                this.showSuccess('Remark saved.');
                await this.renderScrutinyList();
            }
        } catch (e) {}
    }

    openStudentCertificates() {
        let modal = document.getElementById('studentCertificatesModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'studentCertificatesModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 760px;">
                    <div class="modal-header">
                        <h3>My Certificates</h3>
                        <button class="close-btn" onclick="closeModal('studentCertificatesModal')">&times;</button>
                    </div>
                    <div style="padding:16px;">
                        <div id="studentCertificatesList" class="items-list" style="max-height:60vh;overflow:auto;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal('studentCertificatesModal'); });
        }
        this.showModal('studentCertificatesModal');
        this.renderStudentCertificatesListModal();
    }

    async renderStudentCertificatesListModal() {
        const listEl = document.getElementById('studentCertificatesList');
        if (!listEl) return;
        listEl.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const list = await this.apiCall('/student_certificates');
            listEl.innerHTML = '';
            if (!list || !list.length) {
                listEl.innerHTML = '<div class="item"><p class="muted">No certificates uploaded yet.</p></div>';
                return;
            }
            list.forEach(c => {
                const div = document.createElement('div');
                div.className = 'item';
                const uploaded = c.uploadedAt ? new Date(c.uploadedAt).toLocaleString() : '';
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${this.escapeHtml(c.name || '')}</h4>
                        <p class="muted">${this.escapeHtml(c.filename || '')}</p>
                        <p><small>${uploaded}</small></p>
                    </div>
                    <div class="item-actions">
                        <a class="add-btn" href="${c.url}" target="_blank">Download</a>
                    </div>
                `;
                listEl.appendChild(div);
            });
        } catch (e) {
            listEl.innerHTML = '<div class="item"><p class="muted">Failed to load.</p></div>';
        }
    }

    openAttendancePage() {
        if (!this.currentCourse || !this.currentYear || !this.currentSection) {
            alert('Select a course, year, and section first.');
            return;
        }
        const url = `/attendance?course=${encodeURIComponent(this.currentCourse)}&year=${encodeURIComponent(this.currentYear)}&section=${encodeURIComponent(this.currentSection)}`;
        window.location.href = url;
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
                <div class="form-actions" style="justify-content:flex-start; gap:12px; margin-top:10px;">
                    <button class="add-btn" onclick="app.openStudentEditProfile()">Edit Profile</button>
                    <button class="add-btn" onclick="window.location.href='https://sourabhdhara.github.io/CSE-Resume-Builder/'">Build Resume</button>
                </div>
            `;

            this.renderStudentActivities(data.activities);
            this.renderStudentAttendanceContainer();
            this.renderStudentCertificates();
        } catch (error) {
            // Error handling already done in apiCall
        }
    }

    // Student self-edit profile (photo and password only)
    openStudentEditProfile() {
        let modal = document.getElementById('studentEditProfileModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'studentEditProfileModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 520px;">
                    <div class="modal-header">
                        <h3>Edit My Profile</h3>
                        <button class="close-btn" onclick="closeModal('studentEditProfileModal')">&times;</button>
                    </div>
                    <form id="studentEditProfileForm" style="padding:16px;">
                        <div class="form-group">
                            <label for="studentEditPhoto">Profile Picture</label>
                            <input type="file" id="studentEditPhoto" accept="image/*" />
                        </div>
                        <div class="form-group">
                            <label for="studentEditCurrentPw">Current Password</label>
                            <input type="password" id="studentEditCurrentPw" placeholder="Enter current password (required if changing password)">
                        </div>
                        <div class="form-group">
                            <label for="studentEditNewPw">New Password</label>
                            <input type="password" id="studentEditNewPw" placeholder="Enter new password">
                        </div>
                        <div class="form-actions" style="justify-content:flex-end;">
                            <button type="button" class="cancel-btn" onclick="closeModal('studentEditProfileModal')">Cancel</button>
                            <button type="submit" class="submit-btn">Save</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal('studentEditProfileModal'); });
        }
        const form = document.getElementById('studentEditProfileForm');
        if (form) form.onsubmit = (e) => this.handleStudentSelfUpdate(e);
        this.showModal('studentEditProfileModal');
    }

    async handleStudentSelfUpdate(e) {
        e.preventDefault();
        const photo = document.getElementById('studentEditPhoto').files[0];
        const currentPw = document.getElementById('studentEditCurrentPw').value.trim();
        const newPw = document.getElementById('studentEditNewPw').value.trim();
        if (!photo && !newPw) { alert('Nothing to update. Select a new photo or enter a new password.'); return; }
        if (newPw && !currentPw) { alert('Enter current password to change password.'); return; }
        const fd = new FormData();
        if (photo) fd.append('studentPhoto', photo);
        if (newPw) { fd.append('currentPassword', currentPw); fd.append('newPassword', newPw); }
        try {
            const res = await this.apiCall('/student_self_update', { method: 'POST', body: fd, headers: {} });
            if (res && res.success) {
                this.closeModal('studentEditProfileModal');
                this.showSuccess('Profile updated.');
                // Refresh profile view
                await this.renderStudentProfile();
            }
        } catch (err) {}
    }

    renderStudentActivities(activities) {
        const activitiesContainer = document.getElementById('studentActivities');
        activitiesContainer.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <h3 style="margin:0;">My Activities</h3>
                <button class="add-btn" style="width:auto;padding:8px 14px;font-size:0.9rem;" onclick="openStudentActivities()">My Activities</button>
            </div>
        `;
        const count = Array.isArray(activities) ? activities.length : 0;
        if (count === 0) {
            activitiesContainer.innerHTML += '<p class="muted">No activities assigned yet.</p>';
        } else {
            activitiesContainer.innerHTML += `<p class="muted">Assigned: ${count}</p>`;
        }
    }

    renderStudentAttendanceContainer() {
        const container = document.getElementById('studentAttendance');
        if (!container) return;
        container.innerHTML = `
            <h3>My Attendance</h3>
            <div class="form-actions" style="justify-content:flex-start; gap:12px; flex-wrap:wrap;">
                <button class="add-btn" onclick="openStudentAttendance()">View Attendance</button>
                <button class="add-btn" onclick="openStudentDispute()">Raise Dispute</button>
                <button class="add-btn" onclick="openStudentDisputeStatus()">Dispute Status</button>
                <button class="add-btn" onclick="app.refreshStudentDashboard()">Refresh</button>
            </div>
            <div id="studentAttendanceSummary" class="items-list" style="margin-top:10px;"></div>
        `;
        // add messages card for student
        const messagesContainer = document.getElementById('studentMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <h3>Messages</h3>
                <div class="form-actions" style="justify-content:flex-start; gap:12px;">
                    <button class="add-btn" onclick="app.openStudentSelectTeacher()">Message</button>
                    <button class="add-btn" onclick="app.openStudentGroups()">Groups</button>
                </div>
            `;
        }
        // Render live attendance summary below the buttons
        this.renderStudentAttendanceSummary();
    }

    // Live attendance summary for student dashboard
    async renderStudentAttendanceSummary() {
        const wrap = document.getElementById('studentAttendanceSummary');
        if (!wrap) return;
        wrap.innerHTML = '<div class="item"><p class="muted">Loading attendance summary...</p></div>';
        try {
            const subjects = await this.apiCall('/student_attendance_subjects');
            if (!subjects || subjects.length === 0) {
                wrap.innerHTML = '<div class="item"><p class="muted">No subjects yet.</p></div>';
                return;
            }
            const rows = [];
            for (const s of subjects) {
                try {
                    const rec = await this.apiCall(`/student_attendance_records?subject=${encodeURIComponent(s)}&detailed=1`);
                    const sum = (obj) => Object.values(obj || {}).reduce((a,b)=>a + (parseInt(b)||0), 0);
                    const p = sum(rec.present); const a = sum(rec.absent); const t = p + a; const pct = t ? Math.round((p*100)/t) : 0;
                    rows.push({ s, p, a, t, pct });
                } catch (e) {
                    rows.push({ s, p: 0, a: 0, t: 0, pct: 0 });
                }
            }
            let html = '';
            rows.forEach(r => {
                const subj = (this.escapeHtml ? this.escapeHtml(r.s) : r.s);
                html += `
                    <div class="item">
                        <div class="item-info">
                            <h4>${subj}</h4>
                            <p class="muted">Present: ${r.p} | Absent: ${r.a} | Total: ${r.t} | Attendance: ${r.pct}%</p>
                        </div>
                    </div>`;
            });
            wrap.innerHTML = html;
        } catch (e) {
            wrap.innerHTML = '<div class="item"><p class="muted">Failed to load summary.</p></div>';
        }
    }

    refreshStudentDashboard() {
        this.renderStudentProfile();
    }

    openStudentActivities() {
        let modal = document.getElementById('studentActivitiesModal');
        if (!modal) {
            // Dynamically create the modal if the template is missing or cached
            modal = document.createElement('div');
            modal.id = 'studentActivitiesModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 780px;">
                    <div class="modal-header">
                        <h3>My Activities</h3>
                        <button class="close-btn" onclick="closeModal('studentActivitiesModal')">&times;</button>
                    </div>
                    <div style="padding: 16px;">
                        <div id="studentActivitiesModalList" class="items-list" style="max-height: 60vh; overflow-y: auto;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            // Click outside to close (keep consistent with global listener too)
            modal.addEventListener('click', (e) => { if (e.target === modal) this.closeModal('studentActivitiesModal'); });
        }
        this.showModal('studentActivitiesModal');
        this.renderStudentActivitiesModal();
    }

    async renderStudentActivitiesModal() {
        const list = document.getElementById('studentActivitiesModalList');
        if (!list) return;
        list.innerHTML = '<p class="muted">Loading...</p>';
        try {
            const data = await this.apiCall('/student_data');
            const activities = (data && Array.isArray(data.activities)) ? data.activities : [];
            list.innerHTML = '';
            if (!activities.length) {
                list.innerHTML = '<div class="item"><p class="muted">No activities assigned yet.</p></div>';
                return;
            }
            activities.forEach(a => {
                const div = document.createElement('div');
                div.className = 'item';
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${a.name} <span class="status-badge" style="margin-left:8px;">${a.status || ''}</span></h4>
                        <p>${a.details}</p>
                        <p><small>Assigned: ${new Date(a.assignedAt || a.createdAt).toLocaleDateString()}</small></p>
                    </div>
                `;
                list.appendChild(div);
            });
        } catch (e) {
            list.innerHTML = '<div class="item"><p class="muted">Failed to load activities.</p></div>';
        }
    }

    async renderStudentAttendanceUI() {
        try {
            const subjectSelect = document.getElementById('studentAttendanceSubject');
            const datesDiv = document.getElementById('studentAttendanceDates');
            const grid = document.getElementById('studentCalendarGrid');
            const label = document.getElementById('studentMonthLabel');
            const prevBtn = document.getElementById('studentCalPrevBtn');
            const nextBtn = document.getElementById('studentCalNextBtn');

            subjectSelect.innerHTML = '';
            datesDiv.textContent = '';

            const subjects = await this.apiCall('/student_attendance_subjects');
            if (!subjects || subjects.length === 0) {
                subjectSelect.innerHTML = '<option value="">No subjects</option>';
                if (grid) grid.innerHTML = '';
                if (label) label.textContent = '';
                datesDiv.textContent = 'No attendance found.';
                return;
            }
            subjects.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s; opt.textContent = s; subjectSelect.appendChild(opt);
            });

            subjectSelect.onchange = async () => {
                const subj = subjectSelect.value;
                const detailed = await this.apiCall(`/student_attendance_records?subject=${encodeURIComponent(subj)}&detailed=1`);
                const present = detailed.present || {};
                // Build expanded list for selected indicators (present duplicates)
                const expanded = [];
                Object.entries(present).forEach(([d, c]) => { for (let i=0;i<(parseInt(c)||0);i++) expanded.push(d); });
                this.studentAttendanceDates = new Set(expanded.map(d => String(d).slice(0,10)));
                // Choose view month: latest attendance date if exists, else current month
                let base = new Date();
                const allDays = Object.keys(present);
                if (allDays && allDays.length) {
                    const sorted = allDays.map(d => new Date(d)).filter(d => !isNaN(d)).sort((a,b) => b - a);
                    if (sorted.length) base = sorted[0];
                }
                this.studentViewYear = base.getFullYear();
                this.studentViewMonth = base.getMonth();
                this.renderStudentAttendanceCalendarWithCounts(detailed);
                const hasAny = Object.keys(present).length || Object.keys(detailed.absent || {}).length;
                datesDiv.textContent = hasAny ? '' : 'No attendance marked.';
            };

            prevBtn.onclick = () => this.studentAttendancePrevMonth();
            nextBtn.onclick = () => this.studentAttendanceNextMonth();

            // Trigger initial load
            subjectSelect.dispatchEvent(new Event('change'));
        } catch (e) {
            console.error(e);
        }
    }

    ymdFromParts(y, m, d) {
        const mm = String(m + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    }

    renderStudentAttendanceCalendarWithCounts(detail) {
        const grid = document.getElementById('studentCalendarGrid');
        const label = document.getElementById('studentMonthLabel');
        if (!grid || this.studentViewYear == null || this.studentViewMonth == null) return;

        const firstDay = new Date(this.studentViewYear, this.studentViewMonth, 1);
        const lastDay = new Date(this.studentViewYear, this.studentViewMonth + 1, 0);
        const startWeekDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        label.textContent = `${firstDay.toLocaleString('default', { month: 'long' })} ${this.studentViewYear}`;
        grid.innerHTML = '';

        const headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        headers.forEach(h => {
            const d = document.createElement('div'); d.className = 'day header'; d.textContent = h; grid.appendChild(d);
        });
        for (let i=0;i<startWeekDay;i++){ const d=document.createElement('div'); d.className='day empty'; grid.appendChild(d); }
        const present = (detail && detail.present) || {}; const absent = (detail && detail.absent) || {};
        for (let day=1; day<=daysInMonth; day++){
            const el = document.createElement('div');
            el.className = 'day';
            const key = this.ymdFromParts(this.studentViewYear, this.studentViewMonth, day);
            // day number
            const num = document.createElement('div'); num.textContent = day; el.appendChild(num);
            const p = parseInt(present[key] || 0, 10);
            const a = parseInt(absent[key] || 0, 10);
            if (p > 0) {
                const sp = document.createElement('span'); sp.className = 'badge present'; sp.textContent = `P:${p}`; el.appendChild(sp);
            }
            if (a > 0) {
                const sa = document.createElement('span'); sa.className = 'badge absent'; sa.textContent = `A:${a}`; el.appendChild(sa);
            }
            grid.appendChild(el);
        }

        const info = document.getElementById('studentAttendanceDates');
        const hasAnyForMonth = Object.keys(present).concat(Object.keys(absent)).some(d => {
            const [y, m] = d.split('-').map(Number);
            return y === this.studentViewYear && (m - 1) === this.studentViewMonth;
        });
        if (!hasAnyForMonth) { info.textContent = 'No attendance marked for this month.'; }
        else { info.textContent = ''; }
    }

    renderStudentAttendanceCalendar() {
        // Kept for backward compatibility; call detailed version with empty counts
        this.renderStudentAttendanceCalendarWithCounts({ present: Array.from(this.studentAttendanceDates).reduce((acc, d) => { acc[d] = 1; return acc; }, {}), absent: {} });
    }

    studentAttendancePrevMonth() {
        if (--this.studentViewMonth < 0) { this.studentViewMonth = 11; this.studentViewYear--; }
        this.renderStudentAttendanceCalendar();
    }

    studentAttendanceNextMonth() {
        if (++this.studentViewMonth > 11) { this.studentViewMonth = 0; this.studentViewYear++; }
        this.renderStudentAttendanceCalendar();
    }

    openStudentAttendance() {
        // Show modal and render UI inside it
        this.showModal('studentAttendanceModal');
        this.renderStudentAttendanceUI();
    }

    // Student Dispute
    openStudentDispute() {
        this.showModal('studentDisputeModal');
        this.renderStudentDisputeUI();
    }

    async renderStudentDisputeUI() {
        // Similar to attendance view but with selectable dates and description
        const subjectSelect = document.getElementById('disputeSubject');
        const grid = document.getElementById('disputeCalendar');
        const label = document.getElementById('disputeMonthLabel');
        const prevBtn = document.getElementById('disputePrevBtn');
        const nextBtn = document.getElementById('disputeNextBtn');
        // Load subjects
        const subjects = await this.apiCall('/student_attendance_subjects');
        subjectSelect.innerHTML = '';
        if (!subjects || subjects.length === 0) {
            subjectSelect.innerHTML = '<option value="">No subjects</option>';
            grid.innerHTML = '';
            label.textContent = '';
            return;
        }
        subjects.forEach(s => {
            const opt = document.createElement('option'); opt.value = s; opt.textContent = s; subjectSelect.appendChild(opt);
        });
        // State for dispute calendar
        this.disputeViewYear = (new Date()).getFullYear();
        this.disputeViewMonth = (new Date()).getMonth();
        this.disputeSelectedDates = new Set();
        const renderCal = () => {
            const firstDay = new Date(this.disputeViewYear, this.disputeViewMonth, 1);
            const lastDay = new Date(this.disputeViewYear, this.disputeViewMonth + 1, 0);
            const startWeekDay = firstDay.getDay();
            const daysInMonth = lastDay.getDate();
            label.textContent = `${firstDay.toLocaleString('default', { month: 'long' })} ${this.disputeViewYear}`;
            grid.innerHTML = '';
            const headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            headers.forEach(h => { const d = document.createElement('div'); d.className='day header'; d.textContent=h; grid.appendChild(d); });
            for (let i=0;i<startWeekDay;i++){ const d=document.createElement('div'); d.className='day empty'; grid.appendChild(d); }
            for (let day=1; day<=daysInMonth; day++){
                const el=document.createElement('div'); el.className='day'; el.textContent=day;
                const key = this.ymdFromParts(this.disputeViewYear, this.disputeViewMonth, day);
                if (this.disputeSelectedDates.has(key)) el.classList.add('selected');
                el.onclick = () => {
                    if (this.disputeSelectedDates.has(key)) { this.disputeSelectedDates.delete(key); el.classList.remove('selected'); }
                    else { this.disputeSelectedDates.add(key); el.classList.add('selected'); }
                };
                grid.appendChild(el);
            }
        };
        prevBtn.onclick = () => { if (--this.disputeViewMonth < 0) { this.disputeViewMonth = 11; this.disputeViewYear--; } renderCal(); };
        nextBtn.onclick = () => { if (++this.disputeViewMonth > 11) { this.disputeViewMonth = 0; this.disputeViewYear++; } renderCal(); };
        renderCal();
    }

    openStudentDisputeStatus() {
        this.showModal('studentDisputeStatusModal');
        this.renderStudentDisputeStatusUI();
    }

    async renderStudentDisputeStatusUI() {
        const sel = document.getElementById('disputeStatusSubject');
        const list = document.getElementById('studentIssuesList');
        sel.innerHTML = '';
        list.innerHTML = '';
        const subjects = await this.apiCall('/student_attendance_subjects');
        if (!subjects || subjects.length === 0) {
            sel.innerHTML = '<option value="">No subjects</option>';
            list.innerHTML = '<p class="muted">No disputes found.</p>';
            return;
        }
        subjects.forEach(s => { const o=document.createElement('option'); o.value=s; o.textContent=s; sel.appendChild(o); });
        sel.onchange = async () => {
            const subject = sel.value;
            const issues = await this.apiCall(`/student_attendance_issues?subject=${encodeURIComponent(subject)}`);
            list.innerHTML = '';
            if (!issues || issues.length === 0) { list.innerHTML = '<p class="muted">No disputes for this subject.</p>'; return; }
            issues.forEach(i => {
                const div = document.createElement('div');
                div.className = 'item';
                div.innerHTML = `
                    <div class="item-info">
                        <p><strong>Subject:</strong> ${i.subject}</p>
                        <p><strong>Dates:</strong> ${i.dates.join(', ')}</p>
                        <p><strong>Description:</strong> ${i.description}</p>
                        <p><strong>Status:</strong> <span class="status-badge">${i.status}</span></p>
                        <p><small>Created: ${new Date(i.createdAt).toLocaleString()}</small></p>
                    </div>
                `;
                list.appendChild(div);
            });
        };
        sel.dispatchEvent(new Event('change'));
    }

    async submitStudentDispute() {
        const subject = document.getElementById('disputeSubject').value;
        const description = document.getElementById('disputeDescription').value.trim();
        const dates = Array.from(this.disputeSelectedDates || []).sort();
        if (!subject || !description || dates.length === 0) {
            alert('Please select subject, at least one date and enter a description.');
            return;
        }
        const res = await this.apiCall('/student_attendance_issue', {
            method: 'POST',
            body: JSON.stringify({ subject, dates, description })
        });
        if (res && res.success) {
            this.closeModal('studentDisputeModal');
            this.showSuccess('Dispute submitted successfully.');
        }
    }

    // Navigation helpers
    backToCourses() {
        // Use browser history for consistent back behavior
        history.back();
    }

    backToYears() {
        history.back();
    }

    backToSections() {
        history.back();
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

    // Secondary Admins (Teachers/Professors)
    async renderSecondaryAdmins() {
        if (!this.currentCourse || !this.currentYear || !this.currentSection) return;
        const container = document.getElementById('secondaryAdminsList');
        if (!container) return;
        container.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const list = await this.apiCall(`/get_secondary_admins/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            container.innerHTML = '';
            if (!list || list.length === 0) {
                container.innerHTML = '<div class="item"><p class="muted">No secondary admins added yet.</p></div>';
                return;
            }
            list.forEach(a => {
                const div = document.createElement('div');
                div.className = 'item';
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${a.name} <span class="muted">(${a.userId})</span></h4>
                        <p>Email: ${a.email || ''} | Phone: ${a.phone || ''}</p>
                    </div>
                    <div class="item-actions">
                        <button class="edit-btn" onclick="app.editSecondaryAdmin('${a.id}')">Edit</button>
                        <button class="delete-item-btn" onclick="app.deleteSecondaryAdmin('${a.id}')">Delete</button>
                    </div>
                `;
                container.appendChild(div);
            });
        } catch (e) {
            container.innerHTML = '<div class="item"><p class="muted">Failed to load secondary admins.</p></div>';
        }
    }

    showAddSecondaryAdminModal() {
        if (this.currentUser?.type !== 'faculty') return; // main admin only
        this.showModal('addSecondaryAdminModal');
        const form = document.getElementById('addSecondaryAdminForm');
        form.onsubmit = (e) => this.handleAddSecondaryAdmin(e);
    }

    async handleAddSecondaryAdmin(e) {
        e.preventDefault();
        if (this.currentUser?.type !== 'faculty') return; // main admin only
        const formData = new FormData();
        formData.append('name', document.getElementById('profName').value.trim());
        formData.append('userId', document.getElementById('profUserId').value.trim());
        formData.append('password', document.getElementById('profPassword').value.trim());
        formData.append('email', document.getElementById('profEmail').value.trim());
        formData.append('phone', document.getElementById('profPhone').value.trim());
        formData.append('fatherName', document.getElementById('profFatherName').value.trim());
        formData.append('fatherPhone', document.getElementById('profFatherPhone').value.trim());
        formData.append('motherName', document.getElementById('profMotherName').value.trim());
        formData.append('motherPhone', document.getElementById('profMotherPhone').value.trim());
        const photo = document.getElementById('profPhoto').files[0];
        if (photo) formData.append('profPhoto', photo);
        // Subjects input (comma-separated -> store as array string)
        const subjRaw = (document.getElementById('profSubjects')?.value || '').trim();
        if (!subjRaw) { alert('Please enter at least one subject.'); return; }
        formData.append('subjects', subjRaw);
        try {
            const res = await this.apiCall(`/add_secondary_admin/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`, {
                method: 'POST',
                body: formData,
                headers: {}
            });
            if (res && res.success) {
                this.closeModal('addSecondaryAdminModal');
                this.showSuccess('Secondary admin added.');
                await this.renderSecondaryAdmins();
            }
        } catch (e) {}
    }

    async editSecondaryAdmin(id) {
        if (this.currentUser?.type !== 'faculty') return; // main admin only
        try {
            const list = await this.apiCall(`/get_secondary_admins/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            const adm = list.find(x => x.id === id);
            if (!adm) return;
            document.getElementById('editProfName').value = adm.name || '';
            document.getElementById('editProfUserId').value = adm.userId || '';
            document.getElementById('editProfPassword').value = adm.password || '';
            document.getElementById('editProfEmail').value = adm.email || '';
            document.getElementById('editProfPhone').value = adm.phone || '';
            document.getElementById('editProfFatherName').value = adm.fatherName || '';
            document.getElementById('editProfFatherPhone').value = adm.fatherPhone || '';
            document.getElementById('editProfMotherName').value = adm.motherName || '';
            document.getElementById('editProfMotherPhone').value = adm.motherPhone || '';
            document.getElementById('editProfSubjects').value = (Array.isArray(adm.subjects) ? adm.subjects.join(', ') : (adm.subjects || ''));
            const form = document.getElementById('editSecondaryAdminForm');
            form.dataset.profId = id;
            this.showModal('editSecondaryAdminModal');
            form.onsubmit = (e) => this.handleEditSecondaryAdmin(e);
        } catch (e) {}
    }

    async handleEditSecondaryAdmin(e) {
        e.preventDefault();
        if (this.currentUser?.type !== 'faculty') return; // main admin only
        const id = e.target.dataset.profId;
        const formData = new FormData();
        formData.append('name', document.getElementById('editProfName').value.trim());
        formData.append('userId', document.getElementById('editProfUserId').value.trim());
        formData.append('password', document.getElementById('editProfPassword').value.trim());
        formData.append('email', document.getElementById('editProfEmail').value.trim());
        formData.append('phone', document.getElementById('editProfPhone').value.trim());
        formData.append('fatherName', document.getElementById('editProfFatherName').value.trim());
        formData.append('fatherPhone', document.getElementById('editProfFatherPhone').value.trim());
        formData.append('motherName', document.getElementById('editProfMotherName').value.trim());
        formData.append('motherPhone', document.getElementById('editProfMotherPhone').value.trim());
        const subjRaw = (document.getElementById('editProfSubjects')?.value || '').trim();
        if (!subjRaw) { alert('Please enter at least one subject.'); return; }
        formData.append('subjects', subjRaw);
        const photo = document.getElementById('editProfPhoto').files[0];
        if (photo) formData.append('profPhoto', photo);
        try {
            const res = await this.apiCall(`/edit_secondary_admin/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: formData,
                headers: {}
            });
            if (res && res.success) {
                this.closeModal('editSecondaryAdminModal');
                this.showSuccess('Secondary admin updated.');
                await this.renderSecondaryAdmins();
            }
        } catch (e) {}
    }

    async deleteSecondaryAdmin(id) {
        if (this.currentUser?.type !== 'faculty') return; // main admin only
        if (!confirm('Delete this secondary admin?')) return;
        try {
            const res = await this.apiCall(`/delete_secondary_admin/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (res && res.success) {
                this.showSuccess('Secondary admin deleted.');
                await this.renderSecondaryAdmins();
            }
        } catch (e) {}
    }

    // Groups (new)
    async openGroupsManager() {
        if (!this.currentCourse || !this.currentYear || !this.currentSection) {
            alert('Select a course/year/section first.');
            return;
        }
        const btn = document.getElementById('createGroupBtn');
        if (btn) btn.style.display = (this.currentUser?.type === 'faculty') ? '' : 'none';
        const syncBtn = document.getElementById('syncAllBtn');
        if (syncBtn) syncBtn.style.display = (this.currentUser?.type === 'faculty') ? '' : 'none';
        this.showModal('groupsModal');
        await this.renderGroupsList();
    }

    async renderGroupsList() {
        const list = document.getElementById('groupsList');
        if (!list) return;
        list.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const groups = await this.apiCall(`/groups/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            list.innerHTML = '';
            if (!groups || !groups.length) {
                list.innerHTML = '<div class="item"><p class="muted">No groups yet. Use Sync All to create default group.</p></div>';
                return;
            }
            groups.forEach(g => {
                const div = document.createElement('div');
                div.className = 'item';
                const photo = g.photo ? `<img src="/uploads/${g.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;margin-right:8px;">` : '';
                div.innerHTML = `
                    <div class="item-info" style="display:flex;align-items:center;gap:8px;">
                        ${photo}
                        <div>
                            <h4>${this.escapeHtml(g.name)} <span class="muted" style="font-weight:normal;">(${g.memberCount || (g.members ? g.members.length : 0)} members)</span></h4>
                            <p class="muted">${this.escapeHtml(g.bio || '')}</p>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="add-btn">Open</button>
                        <button class="edit-btn" style="${this.currentUser?.type === 'faculty' ? '' : 'display:none;'}">Settings</button>
                    </div>
                `;
                const [openBtn, settingsBtn] = div.querySelectorAll('button');
                openBtn.onclick = () => this.openGroupChat(g);
                if (settingsBtn) settingsBtn.onclick = () => this.openGroupSettings(g);
                list.appendChild(div);
            });
        } catch (e) {
            list.innerHTML = '<div class="item"><p class="muted">Failed to load groups.</p></div>';
        }
    }

    async syncAutoGroup() {
        try {
            const res = await this.apiCall(`/groups/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/auto`, { method: 'POST' });
            if (res && res.success) {
                this.showSuccess('All Members group is up-to-date.');
                await this.renderGroupsList();
            }
        } catch (e) {}
    }

    async openCreateGroupModal() {
        if (this.currentUser?.type !== 'faculty') return; // main admin only
        this.showModal('createGroupModal');
        const teachersBox = document.getElementById('createGroupTeachers');
        const studentsBox = document.getElementById('createGroupStudents');
        teachersBox.innerHTML = '<div class="muted">Loading...</div>';
        studentsBox.innerHTML = '<div class="muted">Loading...</div>';
        try {
            const teachers = await this.apiCall(`/get_secondary_admins/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            const students = await this.apiCall(`/get_students/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            teachersBox.innerHTML = '';
            const mainDiv = document.createElement('div');
            mainDiv.innerHTML = `<label><input type="checkbox" value="teacher:faculty"> Main Admin</label>`;
            teachersBox.appendChild(mainDiv);
            (teachers || []).forEach(t => {
                const d = document.createElement('div');
                d.innerHTML = `<label><input type="checkbox" value="teacher:${this.escapeHtml(t.userId)}"> ${this.escapeHtml(t.name)} (${this.escapeHtml(t.userId)})</label>`;
                teachersBox.appendChild(d);
            });
            studentsBox.innerHTML = '';
            (students || []).forEach(s => {
                const d = document.createElement('div');
                d.innerHTML = `<label><input type="checkbox" value="student:${this.escapeHtml(s.id)}"> ${this.escapeHtml(s.name)} (${this.escapeHtml(s.rollNumber)})</label>`;
                studentsBox.appendChild(d);
            });
        } catch (e) {
            teachersBox.innerHTML = '<div class="muted">Failed.</div>';
            studentsBox.innerHTML = '<div class="muted">Failed.</div>';
        }
        const form = document.getElementById('createGroupForm');
        form.onsubmit = (ev) => this.handleCreateGroup(ev);
    }

    async handleCreateGroup(e) {
        e.preventDefault();
        if (this.currentUser?.type !== 'faculty') return;
        const name = document.getElementById('groupName').value.trim();
        const bio = document.getElementById('groupBio').value.trim();
        const photo = document.getElementById('groupPhoto').files[0];
        const members = [];
        document.querySelectorAll('#createGroupTeachers input:checked, #createGroupStudents input:checked').forEach(chk => members.push(chk.value));
        const fd = new FormData();
        fd.append('name', name);
        fd.append('bio', bio);
        fd.append('members', JSON.stringify(members));
        if (photo) fd.append('groupPhoto', photo);
        try {
            const res = await this.apiCall(`/groups/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/custom`, {
                method: 'POST', body: fd, headers: {}
            });
            if (res && res.success) {
                this.closeModal('createGroupModal');
                this.showSuccess('Group created.');
                await this.renderGroupsList();
            }
        } catch (e) {}
    }

    openGroupSettings(group) {
        if (this.currentUser?.type !== 'faculty') return;
        this._editingGroup = group;
        document.getElementById('editGroupName').value = group.name || '';
        document.getElementById('editGroupBio').value = group.bio || '';
        const whoSel = document.getElementById('groupWhoCanChat');
        const mode = group.permissions?.whoCanChat || 'all';
        whoSel.value = mode;
        document.getElementById('groupPermCustomWrap').style.display = (mode === 'custom') ? '' : 'none';
        const cont = document.getElementById('groupPermAllowed');
        cont.innerHTML = '';
        const allowed = new Set(group.permissions?.allowedMemberIds || []);
        (group.members || []).forEach(m => {
            const key = `${m.type}:${m.id}`;
            const div = document.createElement('div');
            div.innerHTML = `<label><input type="checkbox" value="${this.escapeHtml(key)}" ${allowed.has(key) ? 'checked' : ''}> ${this.escapeHtml(m.name)} <span class="muted">(${this.escapeHtml(key)})</span></label>`;
            cont.appendChild(div);
        });
        whoSel.onchange = () => {
            document.getElementById('groupPermCustomWrap').style.display = (whoSel.value === 'custom') ? '' : 'none';
        };
        const form = document.getElementById('groupSettingsForm');
        form.onsubmit = (ev) => this.handleSaveGroupSettings(ev);
        this.showModal('groupSettingsModal');
    }

    async handleSaveGroupSettings(e) {
        e.preventDefault();
        if (this.currentUser?.type !== 'faculty' || !this._editingGroup) return;
        const gid = this._editingGroup.id;
        const name = document.getElementById('editGroupName').value.trim();
        const bio = document.getElementById('editGroupBio').value.trim();
        const photo = document.getElementById('editGroupPhoto').files[0];
        const who = document.getElementById('groupWhoCanChat').value;
        const allowed = [];
        document.querySelectorAll('#groupPermAllowed input:checked').forEach(chk => allowed.push(chk.value));
        const fd = new FormData();
        fd.append('name', name);
        fd.append('bio', bio);
        fd.append('permissions', JSON.stringify({ whoCanChat: who, allowedMemberIds: allowed }));
        if (photo) fd.append('groupPhoto', photo);
        try {
            const res = await this.apiCall(`/groups/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}/${encodeURIComponent(gid)}`, {
                method: 'PUT', body: fd, headers: {}
            });
            if (res && res.success) {
                this.closeModal('groupSettingsModal');
                this.showSuccess('Group updated.');
                await this.renderGroupsList();
            }
        } catch (e) {}
    }

    async openGroupChat(group) {
        this.setChatContext({
            mode: 'group',
            course: this.currentCourse,
            year: this.currentYear,
            section: this.currentSection,
            groupId: group.id,
            peerName: group.name,
            peerPhoto: group.photo ? `/uploads/${group.photo}` : null,
            groupMembers: Array.isArray(group.members) ? group.members : []
        });
        const permBtn = document.getElementById('chatRestrictionBtn');
        if (permBtn) {
            permBtn.style.display = (this.currentUser?.type === 'faculty') ? '' : 'none';
            permBtn.onclick = () => this.openGroupSettings(group);
        }
        this.renderChatHeader();
        // Ensure Groups modal is closed to avoid stacking behind it
        this.closeModal('groupsModal');
        this.showModal('chatModal');
        await this.loadGroupMessages();
    }

    async loadGroupMessages() {
        const box = document.getElementById('chatMessages');
        if (!this.chat || this.chat.mode !== 'group') { box.innerHTML = '<p class="muted">No group selected.</p>'; return; }
        box.innerHTML = '<p class="muted">Loading...</p>';
        try {
            const { course, year, section, groupId } = this.chat;
            const msgs = await this.apiCall(`/groups/messages/${encodeURIComponent(course)}/${encodeURIComponent(year)}/${encodeURIComponent(section)}/${encodeURIComponent(groupId)}`);
            box.innerHTML = '';
            if (!msgs || !msgs.length) { box.innerHTML = '<p class="muted">No messages yet. Say hello!</p>'; return; }
            msgs.forEach(m => this.appendGroupMessage(m));
            box.scrollTop = box.scrollHeight;
        } catch (e) {
            box.innerHTML = '<p class="muted">Failed to load group messages.</p>';
        }
    }

    appendGroupMessage(m) {
        const box = document.getElementById('chatMessages');
        const wrap = document.createElement('div');
        wrap.style.margin = '8px 0';
        const isMine = (this.currentUser?.type === 'faculty' || this.currentUser?.type === 'secondary') ? (m.from?.type === 'teacher') : (m.from?.type === 'student');
        wrap.style.textAlign = isMine ? 'right' : 'left';
        const bubble = document.createElement('div');
        bubble.style.display = 'inline-block';
        bubble.style.padding = '8px 12px';
        bubble.style.borderRadius = '10px';
        bubble.style.maxWidth = '70%';
        bubble.style.background = isMine ? '#667eea' : '#edf2f7';
        bubble.style.color = isMine ? 'white' : '#1a202c';
        const time = new Date(m.ts || Date.now()).toLocaleString();
        const senderLabel = m.from ? this.getGroupSenderName(m.from) : '';
        const textHtml = m.text ? `<div style=\"white-space:pre-wrap;\">${this.escapeHtml(m.text)}</div>` : '';
        const attHtml = (m.attachments || []).map(a => `<div><a href=\"${a.url}\" target=\"_blank\" style=\"color:inherit;text-decoration:underline;\">${this.escapeHtml(a.filename || 'file')}</a></div>`).join('');
        bubble.innerHTML = `${senderLabel ? `<div class=\\"muted\\" style=\\"font-size:0.8rem; margin-bottom:4px;\\">${senderLabel}</div>` : ''}${textHtml}${attHtml}${time ? `<div class=\\"muted\\" style=\\"font-size:0.8rem; margin-top:4px;\\">${time}</div>` : ''}`;
        wrap.appendChild(bubble);
        box.appendChild(wrap);
    }

    getGroupSenderName(from) {
        try {
            if (!from) return '';
            const type = from.type;
            const id = from.id;
            if (type === 'teacher' && id === 'faculty') return 'Main Admin';
            const members = (this.chat && Array.isArray(this.chat.groupMembers)) ? this.chat.groupMembers : [];
            const match = members.find(m => m && m.type === type && m.id === id);
            if (match && match.name) return String(match.name);
            return `${type}:${id}`;
        } catch (e) {
            return '';
        }
    }

    // Messaging
    async renderMessagesTab() {
        if (!this.currentCourse || !this.currentYear || !this.currentSection) return;
        const container = document.getElementById('messagesStudentsList');
        if (!container) return;
        container.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const students = await this.apiCall(`/get_students/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
            container.innerHTML = '';
            if (!students || students.length === 0) {
                container.innerHTML = '<div class="item"><p class="muted">No students found in this section.</p></div>';
                return;
            }
            students.forEach(s => {
                const div = document.createElement('div');
                div.className = 'item';
                div.innerHTML = `
                    <div class="item-info">
                        <h4>${s.name}</h4>
                        <p>Roll: ${s.rollNumber} | Email: ${s.email}</p>
                    </div>
                    <div class="item-actions">
                        <button class="add-btn">Chat</button>
                    </div>
                `;
                div.querySelector('button').onclick = () => this.openTeacherChatToStudent(s.id);
                container.appendChild(div);
            });
        } catch (e) {
            container.innerHTML = '<div class="item"><p class="muted">Failed to load students.</p></div>';
        }
    }

    setChatContext(ctx) { this.chat = { ...ctx }; }

    async openTeacherChatToStudent(studentId) {
        if (!this.currentCourse || !this.currentYear || !this.currentSection) {
            alert('Select a course/year/section first.');
            return;
        }
        const students = await this.apiCall(`/get_students/${encodeURIComponent(this.currentCourse)}/${encodeURIComponent(this.currentYear)}/${encodeURIComponent(this.currentSection)}`);
        const student = students.find(s => s.id === studentId);
        if (!student) { alert('Student not found'); return; }
        const teacherId = (this.currentUser?.type === 'faculty') ? 'faculty' : (this.currentUser?.userId || '');
        this.setChatContext({
            mode: 'teacher',
            course: this.currentCourse,
            year: this.currentYear,
            section: this.currentSection,
            studentId: student.id,
            teacherId,
            peerName: student.name,
            peerPhoto: student.photo ? `/uploads/${student.photo}` : null
        });
        this.renderChatHeader();
        this.showModal('chatModal');
        await this.loadChatMessages();
    }

    async openStudentSelectTeacher() {
        try {
            const list = await this.apiCall('/student_teachers');
            const container = document.getElementById('teacherList');
            container.innerHTML = '';
            if (!list || !list.length) {
                container.innerHTML = '<div class="item"><p class="muted">No teachers found for your section.</p></div>';
            } else {
                list.forEach(t => {
                    const div = document.createElement('div');
                    div.className = 'item';
                    div.innerHTML = `
                        <div class="item-info">
                            <h4>${t.name} <span class="muted">(${t.userId || ''})</span></h4>
                            <p>Email: ${t.email || ''} | Phone: ${t.phone || ''}</p>
                        </div>
                        <div class="item-actions">
                            <button class="add-btn">Message</button>
                        </div>
                    `;
                    div.querySelector('button').onclick = () => this.openStudentChatToTeacher(t);
                    container.appendChild(div);
                });
            }
            this.showModal('selectTeacherModal');
        } catch (e) {}
    }

    async openStudentChatToTeacher(teacher) {
        const data = await this.apiCall('/student_data');
        const studentId = data.student?.id;
        if (!studentId) { alert('Student context not found'); return; }
        this.setChatContext({
            mode: 'student',
            course: data.course,
            year: data.year,
            section: data.section,
            studentId,
            teacherId: teacher.userId,
            peerName: teacher.name,
            peerPhoto: teacher.photo ? `/uploads/${teacher.photo}` : null
        });
        this.renderChatHeader();
        this.closeModal('selectTeacherModal');
        this.showModal('chatModal');
        await this.loadChatMessages();
    }

    async openStudentGroups() {
        // Students can view groups they belong to
        this.showModal('groupsModal');
        const createBtn = document.getElementById('createGroupBtn');
        if (createBtn) createBtn.style.display = 'none';
        const syncBtn = document.getElementById('syncAllBtn');
        if (syncBtn) syncBtn.style.display = 'none';
        const list = document.getElementById('groupsList');
        if (!list) return;
        list.innerHTML = '<div class="item"><p class="muted">Loading...</p></div>';
        try {
            const groups = await this.apiCall('/student_groups');
            list.innerHTML = '';
            if (!groups || !groups.length) {
                list.innerHTML = '<div class="item"><p class="muted">No groups available.</p></div>';
                return;
            }
            groups.forEach(g => {
                const div = document.createElement('div');
                div.className = 'item';
                const photo = g.photo ? `<img src="/uploads/${g.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;margin-right:8px;">` : '';
                div.innerHTML = `
                    <div class="item-info" style="display:flex;align-items:center;gap:8px;">
                        ${photo}
                        <div>
                            <h4>${this.escapeHtml(g.name)} <span class="muted" style="font-weight:normal;">(${g.memberCount || (g.members ? g.members.length : 0)} members)</span></h4>
                            <p class="muted">${this.escapeHtml(g.bio || '')}</p>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="add-btn">Open</button>
                    </div>
                `;
                const openBtn = div.querySelector('button');
                openBtn.onclick = () => this.openStudentGroupChat(g);
                list.appendChild(div);
            });
        } catch (e) {
            list.innerHTML = '<div class="item"><p class="muted">Failed to load groups.</p></div>';
        }
    }

    async openStudentGroupChat(group) {
        // Open group chat as student
        const data = await this.apiCall('/student_data');
        this.setChatContext({
            mode: 'group',
            course: data.course,
            year: data.year,
            section: data.section,
            groupId: group.id,
            peerName: group.name,
            peerPhoto: group.photo ? `/uploads/${group.photo}` : null,
            groupMembers: Array.isArray(group.members) ? group.members : []
        });
        const permBtn = document.getElementById('chatRestrictionBtn');
        if (permBtn) permBtn.style.display = 'none';
        this.renderChatHeader();
        this.closeModal('groupsModal');
        this.showModal('chatModal');
        await this.loadGroupMessages();
    }

    renderChatHeader() {
        const nameEl = document.getElementById('chatPeerName');
        const metaEl = document.getElementById('chatPeerMeta');
        const imgEl = document.getElementById('chatPeerPhoto');
        nameEl.textContent = this.chat?.peerName || 'Chat';
        metaEl.textContent = this.chat ? `${this.chat.course} > ${this.chat.year} > ${this.chat.section}` : '';
        if (this.chat?.peerPhoto) { imgEl.src = this.chat.peerPhoto; imgEl.style.display = ''; }
        else { imgEl.style.display = 'none'; }
    }

    async loadChatMessages() {
        const box = document.getElementById('chatMessages');
        if (!this.chat) { box.innerHTML = '<p class="muted">No chat context.</p>'; return; }
        box.innerHTML = '<p class="muted">Loading...</p>';
        try {
            const { course, year, section, studentId, teacherId } = this.chat;
            const msgs = await this.apiCall(`/messages/thread/${encodeURIComponent(course)}/${encodeURIComponent(year)}/${encodeURIComponent(section)}?studentId=${encodeURIComponent(studentId)}&teacherId=${encodeURIComponent(teacherId)}`);
            box.innerHTML = '';
            if (!msgs || !msgs.length) { box.innerHTML = '<p class="muted">No messages yet. Say hello!</p>'; return; }
            msgs.forEach(m => this.appendChatMessage(m));
            box.scrollTop = box.scrollHeight;
        } catch (e) {
            box.innerHTML = '<p class="muted">Failed to load messages.</p>';
        }
    }

    appendChatMessage(m) {
        const box = document.getElementById('chatMessages');
        const wrap = document.createElement('div');
        wrap.style.margin = '8px 0';
        const isMine = (this.chat.mode === 'student' && m.from === 'student') || (this.chat.mode === 'teacher' && m.from === 'teacher');
        wrap.style.textAlign = isMine ? 'right' : 'left';
        const bubble = document.createElement('div');
        bubble.style.display = 'inline-block';
        bubble.style.padding = '8px 12px';
        bubble.style.borderRadius = '10px';
        bubble.style.maxWidth = '70%';
        bubble.style.background = isMine ? '#667eea' : '#edf2f7';
        bubble.style.color = isMine ? 'white' : '#1a202c';
        const time = new Date(m.ts || Date.now()).toLocaleString();
        const textHtml = m.text ? `<div style="white-space:pre-wrap;">${this.escapeHtml(m.text)}</div>` : '';
        const attHtml = (m.attachments || []).map(a => `<div><a href="${a.url}" target="_blank" style="color:inherit;text-decoration:underline;">${this.escapeHtml(a.filename || 'file')}</a></div>`).join('');
        bubble.innerHTML = `${textHtml}${attHtml}${time ? `<div class=\"muted\" style=\"font-size:0.8rem; margin-top:4px;\">${time}</div>` : ''}`;
        wrap.appendChild(bubble);
        box.appendChild(wrap);
    }

    escapeHtml(s) { return String(s || '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

    async sendChatMessage() {
        if (!this.chat) return;
        const textEl = document.getElementById('chatText');
        const filesEl = document.getElementById('chatFiles');
        const text = textEl.value.trim();
        const files = Array.from(filesEl.files || []);
        if (!text && files.length === 0) return;
        const fd = new FormData();
        if (this.chat.mode !== 'group') {
            fd.append('studentId', this.chat.studentId);
            fd.append('teacherId', this.chat.teacherId);
        }
        fd.append('text', text);
        files.forEach(f => fd.append('files', f));
        try {
            let res;
            if (this.chat.mode === 'group') {
                res = await this.apiCall(`/groups/messages/${encodeURIComponent(this.chat.course)}/${encodeURIComponent(this.chat.year)}/${encodeURIComponent(this.chat.section)}/${encodeURIComponent(this.chat.groupId)}`, {
                    method: 'POST', body: fd, headers: {}
                });
            } else {
                res = await this.apiCall(`/messages/send/${encodeURIComponent(this.chat.course)}/${encodeURIComponent(this.chat.year)}/${encodeURIComponent(this.chat.section)}`, {
                    method: 'POST', body: fd, headers: {}
                });
            }
            if (res && res.success && res.message) {
                if (this.chat.mode === 'group') this.appendGroupMessage(res.message);
                else this.appendChatMessage(res.message);
                const box = document.getElementById('chatMessages');
                box.scrollTop = box.scrollHeight;
                textEl.value = ''; filesEl.value = '';
            }
        } catch (e) {}
    }

}

let app;

// Global functions for HTML onclick events
function showFacultyLogin() { app.showFacultyLogin(); }
function showStudentLogin() { app.showStudentLogin(); }
function showLandingPage() { app.showLandingPage(); }
function logout() { app.logout(); }
function backToCourses() { app.backToCourses(); }
function backToYears() { app.backToYears(); }
function backToSections() { app.backToSections(); }
function switchTab(tabName) { app.switchTab(tabName); }
function openAttendancePage() { app.openAttendancePage(); }
function openStudentAttendance() { app.openStudentAttendance(); }
function openStudentDispute() { app.openStudentDispute(); }
function submitStudentDispute() { app.submitStudentDispute(); }
function openStudentDisputeStatus() { app.openStudentDisputeStatus(); }
function openStudentActivities() { app.openStudentActivities(); }
function sendChatMessage() { app.sendChatMessage(); }
function openStudentGroups() { app.openStudentGroups(); }

// Modal functions
function showAddCourseModal() { app.showModal('addCourseModal'); }
function showAddYearModal() { app.showModal('addYearModal'); }
function showAddSectionModal() { app.showModal('addSectionModal'); }
function showAddStudentModal() { app.showModal('addStudentModal'); }
function showAddActivityModal() { app.showModal('addActivityModal'); }
function showAddSecondaryAdminModal() { app.showAddSecondaryAdminModal(); }
function closeModal(modalId) { app.closeModal(modalId); }

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        const modalId = e.target.id;
        app.closeModal(modalId);
    }
});

// Initialize app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', function() {
    app = new StudentTrackRecorder();
    app.showLandingPage();
});