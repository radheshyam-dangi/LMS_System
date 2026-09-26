const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/modules',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const modules = JSON.parse(data);
      if (modules && modules.length > 0) {
        const modId = modules[0].id;
        console.log(`Found module ${modId}, fetching details...`);
        
        http.get(`http://localhost:3000/modules/${modId}`, (res2) => {
            let data2 = '';
            res2.on('data', (chunk) => data2 += chunk);
            res2.on('end', () => {
                const modDetails = JSON.parse(data2);
                console.log(JSON.stringify({
                    id: modDetails.id,
                    title: modDetails.title,
                    lessons: modDetails.lessons?.map(l => ({
                        id: l.id,
                        title: l.title,
                        assignmentsCount: l.assignments?.length
                    })),
                    moduleAssignmentsCount: modDetails.assignments?.length
                }, null, 2));
            });
        });
      } else {
        console.log("No modules found");
      }
    } catch(e) {
      console.log("Error parsing response:", e);
    }
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
