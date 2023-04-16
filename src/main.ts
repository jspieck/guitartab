import { createApp } from 'vue'
import './assets/css/guitarTab.scss'
import App from './App.vue'
import store from "./assets/js/store";

createApp(App).use(store).mount('#app')
