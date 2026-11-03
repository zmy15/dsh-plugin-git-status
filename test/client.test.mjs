import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('conversation slots inject the current session id into the component props', () => {
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
  const header = registrations.find(({ options }) => options.name === 'conversation.session.header.utilities');
  const hero = registrations.find(({ options }) => options.name === 'conversation.hero.options');

  assert.ok(header, 'the active session header utilities slot must be registered');
  assert.ok(hero, 'the hero options slot must be registered');
  assert.deepEqual(
    { ...header.options.inject('session-1') },
    { sessionId: 'session-1', placement: 'header-utility' },
  );
  assert.deepEqual(
    { ...hero.options.inject('session-1') },
    { sessionId: 'session-1', placement: 'hero-options' },
  );
});
