import { gameSetting } from '@renderer/store/gamesetting'
import { gameState } from '@renderer/store/gamestate'
import type { RecordingTarget } from '@common/option'
import type { RecordingSource } from '@common/recording'
import { recordingMediaConstraints } from '@renderer/common/recording'

const RecoringPerMSec = 2000

class Recorder {
  private recorder: MediaRecorder
  private isEnd: boolean = false
  public readonly target: RecordingTarget

  constructor(stream: MediaStream, target: RecordingTarget) {
    this.target = target
    const options: MediaRecorderOptions = {
      mimeType: gameSetting.capture_codec
    }
    this.recorder = new MediaRecorder(stream, options)
    this.recorder.ondataavailable = (event) => this.onDataavailable(event)
    this.recorder.onstart = (event) => this.onStart(event)
    this.recorder.onstop = (event) => this.onStop(event)
    this.recorder.onerror = (event) => this.onError(event)
    console.log('recorder ready', stream)
  }

  private async onDataavailable(event: BlobEvent) {
    console.log('recorder dataavailable', event, this.recorder.state)
    const buffer = await event.data.arrayBuffer()
    window.api.storeRec(Buffer.from(buffer), this.isEnd)
  }

  private onStart(event: Event): void {
    gameState.record_ready = 'initialized'
    console.log('recorder onstart', event, this.recorder.state)
    gameState.recording_state = this.recorder.state
  }

  private onStop(event: Event): void {
    console.log('recorder onstop', event, this.recorder.state)
    gameState.recording_state = this.recorder.state
  }

  private onError(event: Event): void {
    console.log('recorder error', event, this.recorder.state)
  }

  public start() {
    console.log('recorder start stream active', this.recorder.stream.active, this.recorder.state)
    if (this.recorder.state !== 'recording') {
      // data save per msec.
      this.isEnd = false
      this.recorder.start(RecoringPerMSec)
    }
  }

  public stop(): void {
    console.log('recorder stop')
    if (this.recorder.state === 'recording') {
      this.isEnd = true
      this.recorder.stop()
    }
  }

  public get isStreamActive(): boolean {
    return this.recorder.stream.active
  }

  public dispose(): void {
    if (this.recorder.state === 'recording') {
      return
    }
    for (const track of this.recorder.stream.getTracks()) {
      track.stop()
    }
  }
}

class RecorderStuffRenderer {
  private recorder: Recorder | undefined
  private startRequestId = 0

  private async replaceSource(source: RecordingSource, requestId: number): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia(
      recordingMediaConstraints(source)
    )
    if (requestId !== this.startRequestId) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
      throw new Error('Recording initialization was superseded')
    }

    this.recorder?.dispose()
    this.recorder = new Recorder(stream, source.target)
    this.recorder.start()
  }

  public async start(): Promise<RecordingTarget> {
    if (gameState.recording_state === 'recording' && this.recorder) {
      return this.recorder.target
    }

    const requestId = ++this.startRequestId
    gameState.record_ready = 'in_initialize'
    try {
      const source = await window.api.getRecordingSource()
      if (
        this.recorder?.target === source.target &&
        this.recorder.isStreamActive
      ) {
        this.recorder.start()
      } else {
        await this.replaceSource(source, requestId)
      }
      gameState.record_ready = 'initialized'
      return source.target
    } catch (error) {
      if (requestId === this.startRequestId) {
        gameState.record_ready = 'not_initialized'
        gameState.recording_state = 'inactive'
      }
      console.error('recording source initialization failed', error)
      throw error
    }
  }

  public stop(): boolean {
    if (gameState.recording_state === 'recording') {
      this.recorder?.stop()
      return true
    }
    return false
  }
}

export const recorderStuffRenderer = new RecorderStuffRenderer()
