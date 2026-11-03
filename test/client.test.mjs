import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('composer dock injects the current session id into the component props', () => {
  let definition;
  const window = {
    __ModuleLoader__: {
      load(next) {
        definition = next;
      },
    },
  };
  const source = readFileSync(join(root, 'client.js'), 'utf8');
  vm.runInNewContext(source, { window }, { filename: join(root, 'client.js') });
  assert.ok(definition, 'client must register a module with the loader');

  const React = {
    createElement() {},
    useCallback(callback) {
      return callback;
    },
    useEffect() {},
    useRef() {
      return { current: null };
    },
    useState(value) {
      return [value, () => {}];
    },
    Fragment: {},
  };
  const plugin = definition.factory((id) => {
    assert.equal(id, 'react');
    return React;
  });

  const registrations = [];
  const ctx = {
    effect(callback) {
      return callback();
    },
    locale: {
      register() {
        return () => {};
      },
    },
    slots: {
      inject(_name, callback) {
        callback();
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };

  plugin.apply(ctx);
  const composer = registrations.find(({ options }) => options.name === 'conversation.composer.dock');
  const hero = registrations.find(({ options }) => options.name === 'conversation.input.dock');

  assert.ok(composer, 'the active composer slot must be registered');
  assert.ok(hero, 'the hero input slot must be registered');
  assert.equal(composer.options.inject('session-1').sessionId, 'session-1');
  assert.deepEqual(
    { ...hero.options.inject('session-1') },
    { sessionId: 'session-1', placement: 'hero' },
  );
});
