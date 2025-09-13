import fs from 'fs';
import YAML from 'yaml';

const REGISTRY = process.env.DEVICES_FILE || '/opt/app/devices.yaml';

export function readDevices(){
  try {
    const txt = fs.readFileSync(REGISTRY, 'utf8');
    const doc = YAML.parse(txt);
    const items = [];
    if(doc && doc.devices){
      for(const [alias, role] of Object.entries(doc.devices)){
        items.push({ alias, role });
      }
    }
    return items;
  } catch(e){
    return [];
  }
}

