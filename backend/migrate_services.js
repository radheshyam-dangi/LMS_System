const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'databaseOrm', 'services');
const modulesDir = path.join(__dirname, 'src', 'databaseOrm', 'modules');
const commonDir = path.join(__dirname, 'src', 'common', 'services');

if (!fs.existsSync(commonDir)) {
  fs.mkdirSync(commonDir, { recursive: true });
}

const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));

for (const file of serviceFiles) {
  const servicePath = path.join(servicesDir, file);
  
  if (file === 'base.service.ts') {
    // move base.service.ts to common
    const dest = path.join(commonDir, file);
    fs.copyFileSync(servicePath, dest);
    continue;
  }
  
  // E.g. assignment.service.ts -> assignment
  const moduleName = file.split('.')[0];
  
  // Find the corresponding module folder. It might be moduleName, or lowercase/camelCase.
  // Let's do a case-insensitive search for the directory.
  const allModules = fs.readdirSync(modulesDir);
  const targetModuleFolder = allModules.find(m => m.toLowerCase() === moduleName.toLowerCase());
  
  if (targetModuleFolder) {
    const targetServicePath = path.join(modulesDir, targetModuleFolder, file);
    
    // We will replace the targetServicePath with the actual service content
    // But first, we must fix the imports in the service content, because it used to be in `services/`, now it's in `modules/xxx/`
    let content = fs.readFileSync(servicePath, 'utf8');
    
    // Fix imports for BaseService:
    // It was `../../types/models/base.model`, now it's `../../../../types/models/base.model`
    // Or wait, from `src/databaseOrm/services` to `src/types/models/base.model` is `../../types...`
    // From `src/databaseOrm/modules/xxx` to `src/types...` is `../../../types...`
    
    // Let's replace `../../types/` with `../../../types/`
    content = content.replace(/..\/..\/types\//g, '../../../types/');
    content = content.replace(/..\/..\/common\//g, '../../../common/');
    
    // For base.service.ts, from services/ to common/services/
    // It used to be `import { BaseService } from './base.service'`
    // Now it should be `import { BaseService } from '../../../common/services/base.service'`
    content = content.replace(/from '.\/base.service'/g, "from '../../../common/services/base.service'");
    
    // Entities were imported as `../entities/...`
    // From `modules/xxx/` to `entities/` is `../../entities/`
    content = content.replace(/from '..\/entities\//g, "from '../../entities/");
    
    // Other services imported as `./xxx.service`
    // e.g. `import { NotificationEntityService } from './notification.service'`
    // Now it should be `import { NotificationEntityService } from '../notification/notification.service'`
    content = content.replace(/from '.\/([a-zA-Z0-9_]+).service'/g, "from '../$1/$1.service'");

    // Write it to the module folder
    fs.writeFileSync(targetServicePath, content);
    console.log(`Migrated ${file} to ${targetModuleFolder}`);
  } else {
    console.log(`Could not find module for ${file}`);
  }
}

// Now we need to update all controllers and modules that imported the wrapper.
// They might be importing `AssignmentEntityService` from `./assignment.service` which is fine.
// What about other modules importing `UserEntityService`?
// They used to import it from `../../services/user.service`.
// Now they should import it from `../user/user.service`.
