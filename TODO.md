# TODO: Fix Delete and Edit Options for Students and Activities

## Backend Changes (app.py)
- [x] Add DELETE route for students: `/delete_student/<course>/<year>/<section>/<student_id>`
- [x] Add PUT route for editing students: `/edit_student/<course>/<year>/<section>/<student_id>`
- [x] Add DELETE route for activities: `/delete_activity/<course>/<year>/<section>/<activity_id>`
- [x] Add PUT route for editing activities: `/edit_activity/<course>/<year>/<section>/<activity_id>`

## Frontend Changes (static/script.js)
- [x] Implement `deleteStudent(studentId)` method to call backend and refresh list
- [x] Implement `editStudent(studentId)` method to show edit modal and handle form submission
- [x] Implement `deleteActivity(activityId)` method to call backend and refresh list
- [x] Implement `editActivity(activityId)` method to show edit modal and handle form submission
- [x] Add edit modals for students and activities (or reuse add modals with pre-filled data)

## Testing
- [ ] Test delete student functionality
- [ ] Test edit student functionality
- [ ] Test delete activity functionality
- [ ] Test edit activity functionality
