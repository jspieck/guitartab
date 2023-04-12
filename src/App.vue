<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Menu from './components/Menu.vue'
import Footer from './components/Footer.vue'
import Compressor from './components/Compressor.vue'
import Equalizer from './components/Equalizer.vue'
import Sequencer from './components/Sequencer.vue'
import GuitarModal from './components/GuitarModal.vue'
import PianoModal from './components/PianoModal.vue'
import { startUp } from './assets/js/guitarTab'

const equalizer = ref(null);

onMounted(() => {
  startUp(equalizer)
})
</script>

<template>
  <div id="content" class="main">
    <svg width="0" height="0">
      <defs>
        <filter x="-0.02" y="0" width="1.04" height="1.1" id="solid">
          <feFlood flood-color="#d4e5f4" />
          <feComposite in="SourceGraphic" operator="atop" />
        </filter>
      </defs>
    </svg>
    <div class="entry-content">
      <Menu />
      <div id="mainContent" class="mainWrapper" ref="mainContent" tabindex="0" @click="() => { $refs.mainContent.focus() }">
        <div id="completeTab" class="dinA4Size">
          <div id="svgTestArea"></div>
          <div id="tabAreas">
            <div id="tabArea" tabindex="0"></div>
          </div>
        </div>
      </div>
  </div>
  <div class="bottomBars">
    <div id="instrumentViewContainer">
      <!--<div id="guitar" class="guitar">
    			<ul id="stringsList" class="strings"></ul>
    			<ul id="stringsListBackTop" class="strings"></ul>
    			<ul id="stringsListBackBottom" class="strings"></ul>
                <div class="guitar-neck">
    				<div id="capo"></div>
                    <div class="fret first"></div>
                    <div id="fretContainer" class="frets"></div>
                    <div class="fret last"></div>
                    <ul id="dots" class="dots"></ul>
                    <div id="guitarMarkerContainer"></div>
                </div>
    			<div class="dot" style="position: absolute;right: 0px;width: 10px;height: 10px;background: #5a5a5a;border: 2px solid #c8bb93;z-index: 20;border-radius: 10px;bottom: -6px;"></div>
    			<div class="dot" style="position: absolute;right: 0px;width: 10px;height: 10px;background: #5a5a5a;border: 2px solid #c8bb93;z-index: 20;border-radius: 10px;top: -6px;"></div>
               <img id="guitarEye" class="visibleEye" src="./images/eyeInverted.svg"/>
              </div>
                <div id="piano" class='piano'>
                    <ul id="pianoList"></ul>
                    <img id="pianoEye" class="visibleEye" src="./images/eye.svg"/>
                </div>-->
      </div>
      <div id="effectBar">
        <div id="effectBarLayout">
          <label id="effectsLabel">Effects</label>
          <div class="knobWrapper">
            <span class="knobTitle">PAN</span>
            <span class="minKnob" style="left:-18px;">LEFT</span>
            <span class="maxKnob" style="right: -24px;">RIGHT</span>
            <div class="knob-inset">
              <div id="panKnob" data-effect="pan" class="knob"></div>
            </div>
          </div>
          <div class="knobWrapper">
            <span class="knobTitle">REVERB</span>
            <span class="minKnob">MIN</span>
            <span class="maxKnob">MAX</span>
            <div class="knob-inset">
              <div id="reverbKnob" data-effect="reverb" class="knob"></div>
            </div>
          </div>
          <div class="knobWrapper">
            <span class="knobTitle">CHORUS</span>
            <span class="minKnob">MIN</span>
            <span class="maxKnob">MAX</span>
            <div class="knob-inset">
              <div id="chorusKnob" data-effect="chorus" class="knob"></div>
            </div>
          </div>
          <div class="knobWrapper">
            <span class="knobTitle">PHASER</span>
            <span class="minKnob">MIN</span>
            <span class="maxKnob">MAX</span>
            <div class="knob-inset">
              <div id="phaserKnob" data-effect="phaser" class="knob"></div>
            </div>
          </div>
        </div>
        <img id="effectEye" class="visibleEye" src="./assets/images/eyeInverted.svg" />
      </div>
      <Sequencer/>
    </div>
    <Footer/>
    <!-- 2 -->
    <div id="loadingWheel" class="loader loader--style2" title="1">
      <svg version="1.1" id="loader-1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
        x="0px" y="0px" width="50px" height="50px" viewBox="0 0 50 50" style="enable-background:new 0 0 50 50;"
        xml:space="preserve">
        <path fill="#274bb3"
          d="M25.251,6.461c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615V6.461z">
          <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25"
            dur="0.6s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>
    <div id="notificationEmblem">
      <img id="infoNotification" src="./assets/images/info.svg">
      <label id="notificationLabel">Saved!</label>
    </div>
    <svg id="svg-source" height="0" version="1.1" xmlns="http://www.w3.org/2000/svg"
      style="position:absolute; margin-left: -100%" xmlns:xlink="http://www.w3.org/1999/xlink">
      <g id="close-icon">
        <path d="M0.014,1.778L1.79,0.001l30.196,30.221l-1.778,1.777L0.014,1.778z" />
        <path d="M1.79,31.999l-1.776-1.777L30.208,0.001l1.778,1.777L1.79,31.999z" />
      </g>
    </svg>

    <div class="mask" role="dialog"></div>
    <div id="modalEditor" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Bend</label>
        <div id="bendModalClose" class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <svg id="bendEditor"></svg>
        <label class="labelRightMargin">Presets:</label>
        <div class="select">
          <select id="bendSelection">
            <option value="0">Bending</option>
            <option value="1">Bend/Release</option>
            <option value="2">Bend/Release/Bend</option>
            <option value="3">PreBend</option>
            <option value="4">PreBend/Release</option>
          </select>
          <div class="select__arrow"></div>
        </div>
        <svg id="selectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <PianoModal id="pianoModal" class="modal" role="alert"></PianoModal>
    
    <div id="drumInfoModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Drum Info</label>
        <div id="drumInfoModalClose" class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div id="drumInfo"></div>
      </div>
    </div>

    <GuitarModal id="guitarModal" class="modal" role="alert"/>

    <div id="reallyDeleteModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Delete</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <h4 class="modalCaption">Do you really want to delete the instrument?</h4>
        <button id="yesDelete" class="deleteButton">Yes, all data will be lost</button>
        <button id="noDelete" class="deleteButton">No</button>
      </div>
    </div>

    <div id="numberOfRepititionsModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Number Repititions</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <input id="numberOfRepititionsInput" />

        <svg id="repititionSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="addTrackModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">New Instrument</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div id="instrumentContainer" class="instrumentContainer"></div>
      </div>
    </div>

    <div id="addRepeatAlternativeModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Repeat Alternative</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <label>Check all suitable endings</label>
        <div id="alternativeContainer">
          <ul class="unstyled centered">
            <li><input class="styled-checkbox" id="styled-checkbox-1" type="checkbox"><label
                for="styled-checkbox-1">1</label></li>
            <li><input class="styled-checkbox" id="styled-checkbox-2" type="checkbox"><label
                for="styled-checkbox-2">2</label></li>
            <li><input class="styled-checkbox" id="styled-checkbox-3" type="checkbox"><label
                for="styled-checkbox-3">3</label></li>
            <li><input class="styled-checkbox" id="styled-checkbox-4" type="checkbox"><label
                for="styled-checkbox-4">4</label></li>
            <li><input class="styled-checkbox" id="styled-checkbox-5" type="checkbox"><label
                for="styled-checkbox-5">5</label></li>
            <li><input class="styled-checkbox" id="styled-checkbox-6" type="checkbox"><label
                for="styled-checkbox-6">6</label></li>
            <li><input class="styled-checkbox" id="styled-checkbox-7" type="checkbox"><label
                for="styled-checkbox-7">7</label></li>
            <li><input class="styled-checkbox" id="styled-checkbox-8" type="checkbox"><label
                for="styled-checkbox-8">8</label></li>
          </ul>
        </div>
        <svg id="repeatAlternativeSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="addHarmonicModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Harmonic</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div class="harmonicSelect">
          <div class="select">
            <select id="harmonicSelection">
              <option value="N.H.">Natural Harmonic (N.H.)</option>
              <option value="A.H.">Artificial Harmonic (A.H.)</option>
              <option value="T.H.">Tapped Harmonic (T.H.)</option>
              <option value="P.H.">Pinch Harmonic (P.H.)</option>
              <option value="S.H.">Semi Harmonic (S.H.)</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <svg id="harmonicSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="addTremoloPickingModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Tremolo Picking</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <label>Choose note length</label>
        <div class="tremoloPickingSelect">
          <div class="select">
            <select id="tremoloPickingSelection">
              <option value="e">Eighth</option>
              <option value="s">Sixteenth</option>
              <option value="t">Thirty-Second</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <svg id="tremoloPickingSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="timeMeterModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Time Meter</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div class="timeMeterSelectCapsule">
          <label class="labelTopMargin">Numerator</label>
          <div class="select">
            <select id="numeratorSelection">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4" selected>4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
              <option value="12">12</option>
              <option value="13">13</option>
              <option value="14">14</option>
              <option value="15">15</option>
              <option value="16">16</option>
              <option value="17">17</option>
              <option value="18">18</option>
              <option value="19">19</option>
              <option value="20">20</option>
              <option value="21">21</option>
              <option value="22">22</option>
              <option value="23">23</option>
              <option value="24">24</option>
              <option value="25">25</option>
              <option value="26">26</option>
              <option value="27">27</option>
              <option value="28">28</option>
              <option value="29">29</option>
              <option value="30">30</option>
              <option value="31">31</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <label class="labelTopMargin">Denominator</label>
          <div class="select timeMeterSelect">
            <select id="denominatorSelection">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="4" selected>4</option>
              <option value="8">8</option>
              <option value="16">16</option>
              <option value="32">32</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <svg id="timeMeterSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="bpmModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Bpm</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div class="bpmSelectCapsule">
          <div id="tempoMeterModal" class="disable-select">90</div>
        </div>
        <svg id="bpmSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>


    <div id="addStrokeModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Stroke</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div class="strokeSelect">
          <label class="labelTopMargin">Stroke Direction</label>
          <div class="select">
            <select id="strokeDirectionSelection">
              <option value="up" selected>Upstroke</option>
              <option value="down">Downstroke</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <label class="labelTopMargin">Stroke Length</label>
          <div class="select">
            <select id="strokeLengthSelection">
              <option value="4">Quarter</option>
              <option value="8" selected>Eighth</option>
              <option value="16">Sixteenth</option>
              <option value="32">32nd</option>
              <option value="64">64th</option>
              <option value="128">128th</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <svg id="strokeSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="addTextModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Text</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div class="strokeSelect">
          <label>Enter text:</label>
          <textarea id="textSelection"></textarea>
        </div>
        <svg id="textSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="addMarkerModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Marker</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div class="strokeSelect">
          <label class="labelTopMargin">Title:</label>
          <input id="markerSelection" />
          <label class="labelTopMargin">Color:</label>
          <input id="markerColorPicker" readonly="readonly" />
        </div>
        <svg id="markerSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="addChordModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Chord</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div class="strokeSelect">
          <label>Choose chord:</label>
          <svg id="chordDisplay"></svg>
          <div class="select">
            <select id="chordRootSelection">
              <option value="C">C</option>
              <option value="C#">C#</option>
              <option value="D">D</option>
              <option value="D#">D#</option>
              <option value="E">E</option>
              <option value="F">F</option>
              <option value="F#">F#</option>
              <option value="G">G</option>
              <option value="G#">G#</option>
              <option value="A">A</option>
              <option value="A#">A#</option>
              <option value="H">H</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <div class="select">
            <select id="chordTypeSelection">
              <option value="maj">Major</option>
              <option value="min">Minor</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <label class="labelTopMargin">Capo:</label><input type="number" id="chordCapoInput" />
          <label>Name:</label><input id="chordNameInput" />
          <label>Used Chords:</label>
          <div class="select">
            <select id="usedChordSelection">
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <svg id="chordSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="chordManagerModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Chord Manager</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <label>Chord diagrams to display:</label>
        <div id="chordOverviewContainer">
          <div id="chordsContainer"></div>
          <button id="addChordDiagram" data-tooltip="Add Chord Diagram">+</button>
        </div>
        <svg id="chordDiagramSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="addGraceModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Grace</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div id="graceSelect">
          <label class="labelTopMargin">Fret</label>
          <input id="graceFretInput" />
          <label class="labelTopMargin">Note length</label>
          <div class="select">
            <select id="graceLengthSelection">
              <option value="e">Eighth</option>
              <option value="s" selected>Sixteenth</option>
              <option value="t">Thirty-Second</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <label class="labelTopMargin">Time of grace</label>
          <div class="select">
            <select id="graceTimeSelection">
              <option value="before" selected>Before the note</option>
              <option value="with">With the note</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <label class="labelTopMargin">Dynamic</label>
          <div class="select">
            <select id="graceDynamicSelection">
              <option value="fff">fff</option>
              <option value="ff">ff</option>
              <option value="f" selected>f</option>
              <option value="mf">mf</option>
              <option value="mp">mp</option>
              <option value="p">p</option>
              <option value="pp">pp</option>
              <option value="ppp">ppp</option>
            </select>
            <div class="select__arrow"></div>
          </div>
          <label class="labelTopMargin">Transition</label>
          <div class="select">
            <select id="graceTransitionSelection">
              <option value="none" selected>None</option>
              <option value="bending">Bending</option>
              <option value="slide">Slide</option>
              <option value="hammer">Hammer</option>
            </select>
            <div class="select__arrow"></div>
          </div>
        </div>
        <svg id="graceSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="tremoloModalEditor" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Tremolo Bar</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <svg id="tremoloEditor"></svg>
        <label class="labelRightMargin">Presets:</label>
        <div class="select">
          <select id="tremoloSelection">
            <option value="0">Dive</option>
            <option value="1">Dip</option>
            <option value="2">Release Up</option>
            <option value="3">Inverted Dip</option>
            <option value="4">Return</option>
            <option value="5">Release Down</option>
          </select>
          <div class="select__arrow"></div>
        </div>
        <svg id="tremoloSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="trackInfoModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Track Info</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <label>Title:</label>
        <input id="songTitleInput" />
        <label>Subtitle:</label>
        <input id="songSubtitleInput" />
        <label>Artist:</label>
        <input id="songArtistInput" />
        <label>Album:</label>
        <input id="songAlbumInput" />
        <label>Author:</label>
        <input id="songAuthorInput" />
        <label>Music:</label>
        <input id="songMusicInput" />
        <label>Copyright:</label>
        <input id="songCopyrightInput" />
        <label>Writer:</label>
        <input id="songWriterInput" />
        <label>Instructions:</label>
        <input id="songInstructionInput" />
        <label>Comments:</label>
        <textarea id="songCommentsInput"></textarea>
        <svg id="infoSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>

    <div id="midiModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">MIDI</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <table id="midiDeviceList">
          <thead>
            <tr>
              <th>Device name</th>
              <th>Manufacturer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="midiDeviceListBody">
          </tbody>
        </table>
      </div>
    </div>

    <div id="samplesModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Copyright</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <label>
          Copyright 2018 Jan Spieck

          The samples that were used for the instruments come from different sources.
          If the usage of any of the samples, is against the will of the respective owner
          the sample will be removed immediately. No copyright infringement is intended.
        </label>
        <table id="sampleSourceList">
          <thead>
            <tr>
              <th>Sample Source</th>
              <th>URL</th>
              <th>Instruments</th>
            </tr>
          </thead>
          <tbody id="midiDeviceListBody">
            <tr>
              <td>Sampled from AmpleSound Guitar VSTs</td>
              <td>http://www.amplesound.net/en/index.asp</td>
              <td>Nylon/Western Guitar, Muted Guitar, Overdrive Guitar, Bass</td>
            </tr>
            <tr>
              <td>Hammondman</td>
              <td>https://freesound.org/people/hammondman/packs/18842/</td>
              <td>Accordeon</td>
            </tr>
            <tr>
              <td>bigcat saxophone collection</td>
              <td>http://bigcatinstruments.blogspot.de/2014/03/bigcat-saxophone-collection.html</td>
              <td>Tenor/Soprano/Bartitone Sax</td>
            </tr>
            <tr>
              <td>bigcat general midi instruments</td>
              <td>http://bigcatinstruments.blogspot.de/2014/08/gm-midi-instruments-for-kontakt.html</td>
              <td>Pan Flute, Blown Bottle, Whistle, Ocarina, SynthBrass 1/2, Muted Tumpret,
                Brass Section, Synth Strings, Orchestra Hit, GuitarFretNoise, Breath Noise,
                Seashore, Bird Tweet, Telephone Ring, Helicopter, Applause, Gunshot,
                Tinkle Bell, Steel Drum, Taiko, Melodic Tom, Synth Drum, Reverse Cymbal, Sitar,
                Shamisen, Koto, Kalimba, Bagpipe, Fiddle, Shanai</td>
            </tr>
            <tr>
              <td>Sampled from Orchestral Companion VST</td>
              <td>https://sonivoxmi.com/products/details/orchestral-companion-strings</td>
              <td>Tremolo Strings, Pizzicato Strings, Violin</td>
            </tr>
            <tr>
              <td>Kontakt Factory Library</td>
              <td>https://www.native-instruments.com/de/products/komplete/samplers/kontakt-5/</td>
              <td>VoicesAah, VoicesOoh, EGuitar, Session Drums, Vibraphone, Agogo, Woodblock</td>
            </tr>
            <tr>
              <td>Leeds Organ</td>
              <td>https://www.samplephonics.com/products/free/sampler-instruments/the-leeds-town-hall-organ</td>
              <td>Organ, Percussive Organ, Church Organ, Rock organ, Reed Organ,</td>
            </tr>
            <tr>
              <td>Don's General Midi Sample Set</td>
              <td>http://midkar.com/soundfonts/</td>
              <td>Piano, Bright Piano, Electric Grand, HonkyTonk, EPiano1, Epiano2, Harpsichord,
                Clavinet, Shakuhachi, Marimba, Tubular Bells, Dulcimer, MusicBox, Celesta,
                Harmonica, Bandoneon, Cabasa & several other drum sounds, Leads, Pads, FX</td>
            </tr>
            <tr>
              <td>Sonatina</td>
              <td>https://sso.mattiaswestlund.net/</td>
              <td>Piccolo, Strings, Alto Sax, Clarinet, Flute, Xylophone, Harp, Glockenspiel, Banjo</td>
            </tr>
            <tr>
              <td>Versilian Orchestra</td>
              <td>http://vis.versilstudios.net/vsco-2.html</td>
              <td>Cello, Contrabass</td>
            </tr>
            <tr>
              <td>Philarmonia Orchestra</td>
              <td>http://www.philharmonia.co.uk/explore/sound_samples</td>
              <td>Tuba, Trumpet, Trombone, French/English Horn</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="mixerModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Mixer</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <div id="mixerMain"></div>
      </div>
    </div>

    <Compressor id="compressorModal" class="modal" role="alert"/>
    <Equalizer ref="equalizer"/>

    <div id="instrumentSettingsModal" class="modal" role="alert">
      <div class="modalTopBar">
        <label class="modalTopBarLabel">Instrument Settings</label>
        <div class="modal_close">
          <div class="icon">
            <svg viewBox="0 0 32 32">
              <use xlink:href="#close-icon"></use>
            </svg>
          </div>
        </div>
      </div>
      <div class="modalBody">
        <label>Name:</label>
        <input id="instrumentNameInput" />
        <label>Color:</label>
        <div id="instrumentColorPicker" readonly="readonly"></div>
        <div id="alternativeContainer">
          <ul class="unstyled">
            <li><input class="styled-checkbox" id="ringCheckbox" type="checkbox"><label for="ringCheckbox">Let it
                ring</label></li>
          </ul>
        </div>
        <label>String Count:</label>
        <div id="stringCountSelectBox" class="select">
          <select id="stringCountSelect">
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
          </select>
          <div class="select__arrow"></div>
        </div>
        <label>Capo:</label>
        <div id="capoSelectBox" class="select">
          <select id="capoSelect">
            <option v-for="num in 16" :value="num - 1">{{ num - 1 }}</option>
          </select>
          <div class="select__arrow"></div>
        </div>
        <label>String Tuning:</label>
        <div id="tuningAreaModal"></div>

        <svg id="instrumentSettingsSelectButton" class="checkmark selectButton" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}</style>
