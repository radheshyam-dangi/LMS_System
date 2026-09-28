const fs = require('fs');

const editorData = {
  "type": "doc",
  "content": [
    {
      "type": "module",
      "attrs": { "id": "mod1" },
      "content": [
        {
          "type": "lesson",
          "attrs": { "id": "les1" },
          "content": [
            {
              "type": "videoBlock",
              "attrs": {
                "url": "https://www.youtube.com/watch?v=hQcFE0RD0cQ"
              }
            }
          ]
        }
      ]
    }
  ]
};

// I will copy parseLPDocument logic here
const lp = {
  title: '',
  description: '',
  modules: []
};

function parseLesson(lessonNode) {
  const lesson = {
    id: lessonNode.attrs?.id,
    title: '',
    videos: [],
    resources: [],
    keyPoints: [],
  };

  for (const block of lessonNode.content || []) {
    switch (block.type) {
      case 'videoBlock':
        if (block.attrs?.url) lesson.videos.push(block.attrs);
        break;
    }
  }
  return lesson;
}

for (const modBlock of editorData.content || []) {
  if (modBlock.type === 'module') {
    const moduleObj = { id: modBlock.attrs.id, lessons: [] };
    for (const child of modBlock.content || []) {
      if (child.type === 'lesson') {
        moduleObj.lessons.push(parseLesson(child));
      }
    }
    lp.modules.push(moduleObj);
  }
}

console.log(JSON.stringify(lp, null, 2));
