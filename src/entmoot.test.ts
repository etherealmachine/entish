import Interpreter from './entmoot';
import fs from 'fs';
const dungeon_world = fs.readFileSync('./src/dungeon_world.ent').toString();

test('can run the interpreter', () => {
	const interpreter = new Interpreter('seed');
	interpreter.load(dungeon_world);
});
