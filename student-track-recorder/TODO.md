# Student Profile Picture Cleanup Implementation

## Completed Tasks
- [x] Update delete_student route to delete profile picture file when student is deleted
- [x] Update edit_student route to delete old profile picture when new photo is uploaded
- [x] Test the implementation to ensure old photos are properly cleaned up

## Summary of Changes
- **delete_student route**: Added logic to find the student being deleted and remove their profile picture file from static/uploads folder before removing from students.json
- **edit_student route**: Added logic to delete the old profile picture file before saving the new photo when editing a student

## Testing
- Delete a student with a profile picture and verify the photo file is removed from uploads folder
- Edit a student by uploading a new photo and verify the old photo file is removed from uploads folder
