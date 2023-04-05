/*
    This is a incomplete file for a cleaner playBackLogic, WIP
 */
var playBackLogic = new function(){
    var scheduleAhead = 0.4;
    /*we have two kinds of times:
        - globalIncreasingTime: always increases (even when jumping back) and helps schedule future notes; always starts at 0
        - globalCurrentPos: gives us the current position relative to the track begin; starts at initial pos in song
    */
    var globalIncreasingTime = 0;
    var globalCurrentPos = 0;
    var startTimesOfBlocks = [];
    var currentBlockId = 0;

    var lengthOfCompleteSong = 0;
    var nextNoteTime = [];
    var initScheduling = false;

    //initialize values: parameters specify the starting point of the playback
    this.startScheduling = function(startingPoint){
        //4/4 blocks have the length 1, 2/4 only the length 0.5 and so on
        var lastBlockStart = 0;
        for(var blockId = 0, numBlocks = measures.length; blockId < numBlocks; blockId++){
            startTimesOfBlocks[blockId] = lastBlockStart;
            lastBlockStart += measureMeta[blockId].numerator/measureMeta[blockId].denominator;
        }
        startTimesOfBlocks[blockId+1] = lastBlockStart; //makes coding easier later
        lengthOfCompleteSong = lastBlockStart;

        lastMeasuredTime = audioEngine.getCurrentTime();
        globalIncreasingTime = 0;

        //find starting pos
        var posInBlock = 0;
        for(var beatId = 0, n = startingPoint.beatId; beatId < n; beatId++){
            posInBlock += Duration.getDurationOfNote(measures[startingPoint.trackId][startingPoint.blockId][startingPoint.voiceId][beatId], true);
        }
        globalCurrentPos = startTimesOfBlocks[startingPoint.blockId] + posInBlock;
        currentBlockId = startingPoint.blockId;

        //initialize arrays
        nextNoteTime = [];
        for(var trackId = 0, numTracks = measures.length; trackId < numTracks; trackId++){
            nextNoteTime[trackId] = [];
        }
        initScheduling = true;
    }

    //schedule for each track and voice the next notes
    this.scheduler = function(){
        var currentTime = audioEngine.getCurrentTime();
        var extraTime = (currentTime-lastMeasuredTime)*bpm/240;
        globalIncreasingTime += extraTime;
        globalCurrentPos = findNextCurrentPos(extraTime);

        for(var trackId = 0, numTracks = measures.length; trackId < numTracks; trackId++){
            for(var voiceId = 0; voiceId < Song.numVoices; voiceId++){
                while(initScheduling || (nextNoteTime[trackId][voiceId] < globalIncreasingTime + scheduleAhead)){
                    if(scheduleNextNote(trackId, voiceId) == false)
                        return;
                }
            }
        }
        initScheduling = false;
        lastMeasuredTime = currentTime;
    }

    //handles repeatjumps and looping intervals to specify current block + pos
    var findNextCurrentPos = function(extraTime){
        //TODO jumps and looping interval
        globalCurrentPos += extraTime;

        if(globalCurrentPos > startTimesOfBlocks[currentBlockId+1]){
            currentBlockId += 1;
            //TODO jumps
        }
    }

    //returns if note was found
    var isNotePlayableInBlock = function(trackId, voiceId, blockId, afterTimePos){
        var posInBlock = 0;
        for(var beatId = 0, n = startingPoint.beatId; beatId < n; beatId++){
            posInBlock += Duration.getDurationOfNote(measures[trackId][blockId][voiceId][beatId], true);
            //TODO smaller than loop interval end
            if(startTimesOfBlocks[blockId+1] + posInBlock/64 > afterTimePos){
                nextNoteTime[trackId][voiceId] = beatTimePos;
                return true;
            }
        }
        return false;
    }

    var findPosAfterBlock = function(currentBlockId){
        //Three cases: nextBlock = block+1, or repeatInterval, or loopInterval
    }

    //schedule playback of nextNote and find the note to schedule after
    var scheduleNextNote = function(trackId, voiceId){
        //check next three blocks for notes
        //worst case : currently after last beat in block; nextBlock loopBegin is after all beats in block
        //then either: the end of jump back block is nextNote, or: no nextNote can be found
        if(!schduledNisNotePlayableInBlock(trackId, voiceId, currentBlockId, globalCurrentPos)){
            var posAfterBlock = findPosAfterBlock(currentBlockId);
        }
    }
}
