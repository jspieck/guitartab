import { createStore } from 'vuex';

export default createStore({
  state: {},
  mutations: {},
  actions: {
    methodInComponentB(_, payload: string) {
      return `Component B method called with parameter: ${payload}`;
    },
  },
  modules: {},
});