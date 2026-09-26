const { DataSource } = require('typeorm');
const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('database.sqlite');
db.all("SELECT id, title, lessonId, moduleId FROM assignment_entity", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Assignments in DB:");
        console.table(rows);
    }
    db.close();
});
