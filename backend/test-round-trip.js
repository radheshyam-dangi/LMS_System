const axios = require('axios');
const assert = require('assert');

// A simple automated API integration round-trip test to prevent field loss regressions
// Run with: node test-round-trip.js <token>
const API_URL = 'http://localhost:3000/api/v1';

async function runTest() {
  const token = process.argv[2];
  if (!token) {
    console.warn("Skipping round-trip test: no auth token provided. Please run as: node test-round-trip.js <token>");
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  console.log("1. Creating LP as Trainer with full field matrix...");
  const draftPayload = {
    title: 'Round Trip Test LP',
    description: 'Test Description',
    level: 'advanced',
    status: 'active',
    skillsTags: ['testing'],
    imageUrl: 'https://example.com/lp.png',
    modules: [{
      title: 'Module 1',
      description: 'Module Description',
      sequentialLessonLock: true,
      learningObjectives: ['Objective 1'],
      learningOutcomes: ['Outcome 1'],
      moduleResources: [{ label: 'Module Resource', url: 'https://example.com/m-res', type: 'Link' }],
      lessons: [{
        title: 'Lesson 1',
        description: 'Lesson Description',
        durationMinutes: 20,
        videos: [{ url: 'https://youtube.com/watch?v=123', title: 'Test Video' }],
        audios: [{ url: 'https://example.com/audio.mp3', title: 'Test Audio' }],
        resources: [{ label: 'Lesson Resource', url: 'https://example.com/l-res', type: 'Link' }],
        keyPoints: ['Key Point 1']
      }],
      assignments: [{
        title: 'Assignment 1',
        body: 'Assignment Instructions',
        lockUntilLessonsComplete: true,
        autoEvaluateWithAI: true,
        humanInterventionRequired: false,
        timerDuration: { days: 0, hours: 1, minutes: 30 },
        countdownStart: 'taskUnlocked',
        questions: [{ text: 'Question 1', type: 'Subjective', maxPoints: 10, requiresLessonGrounding: false }]
      }]
    }]
  };

  const createRes = await axios.post(`${API_URL}/lp-authoring/submit`, draftPayload, { headers });
  const lpId = createRes.data.id;
  const moduleId = createRes.data.modules[0].id;
  const lessonId = createRes.data.modules[0].lessons[0].id;
  console.log(`-> Created LP: ${lpId}, Lesson: ${lessonId}`);

  console.log("2. Reading back as Trainee...");
  // Note: To test exactly what trainee sees, we query the module details.
  const traineeRes = await axios.get(`${API_URL}/modules/${moduleId}`, { headers });
  const traineeLesson = traineeRes.data.lessons.find(l => l.id === lessonId);
  
  assert.strictEqual(traineeLesson.title, 'Lesson 1');
  assert.strictEqual(traineeLesson.description, 'Lesson Description');
  assert.strictEqual(traineeLesson.durationMinutes, 20);
  assert.strictEqual(traineeLesson.videoUrl, 'https://youtube.com/watch?v=123');
  assert.deepStrictEqual(traineeLesson.videos[0].url, 'https://youtube.com/watch?v=123');
  assert.deepStrictEqual(traineeLesson.audios[0].url, 'https://example.com/audio.mp3');
  assert.strictEqual(traineeLesson.keyPoints[0], 'Key Point 1');
  console.log("-> Initial parity verified!");

  console.log("3. Editing LP as Trainer (clearing audio, changing video)...");
  draftPayload.id = lpId;
  draftPayload.modules[0].id = moduleId;
  draftPayload.modules[0].lessons[0].id = lessonId;
  draftPayload.modules[0].lessons[0].videos = [{ url: 'https://youtube.com/watch?v=456', title: 'New Video' }];
  draftPayload.modules[0].lessons[0].audios = []; // cleared

  await axios.post(`${API_URL}/lp-authoring/submit`, draftPayload, { headers });
  
  console.log("4. Reading back as Trainee to verify update...");
  const updateRes = await axios.get(`${API_URL}/modules/${moduleId}`, { headers });
  const updatedLesson = updateRes.data.lessons.find(l => l.id === lessonId);
  
  assert.strictEqual(updatedLesson.videoUrl, 'https://youtube.com/watch?v=456');
  assert.deepStrictEqual(updatedLesson.audios, []);
  
  console.log("-> Update parity verified!");
  console.log("Round-trip test passed successfully.");
}

runTest().catch(err => {
  console.error("Test failed:", err.message);
  if (err.response) console.error(err.response.data);
  process.exit(1);
});
