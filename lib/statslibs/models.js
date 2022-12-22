// info about transcription from files: processing_data.json
class TranscriptionInfo{
    static from(json){
        return Object.assign(new TranscriptionInfo(), json);
    }
}

// class to represent basic per period stats for showing on frontend
class TranscriptionStat{
    constructor(transcriptionsCount=0, timeTranscribed=0) {
        this.transcriptionsCount = transcriptionsCount;
        this.timeTranscribed = timeTranscribed;
    }
}

class TranscriptionStatPerPeriod{
    constructor(){
        this.total = new TranscriptionStat();
        this.last30days = new TranscriptionStat();
        this.last7days = new TranscriptionStat();
        this.last24h = new TranscriptionStat();
    }
}

class TranscriptionFullStats{
    constructor(){
        this.allTranscriptionPerPeriod = new TranscriptionStatPerPeriod();
        this.languagesStats = {};
    }
}

module.exports = {
    TranscriptionInfo,
    TranscriptionStat,
    TranscriptionStatPerPeriod,
    TranscriptionFullStats
}