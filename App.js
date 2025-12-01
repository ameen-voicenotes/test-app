import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect } from 'react';
import { Button, FlatList, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import Sound, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  RecordBackType,
  PlayBackType,
} from 'react-native-nitro-sound';
// import { RecordingStarter } from 'react-native-recording-starter';
import { AppRegistry } from 'react-native';
import { NitroSound } from 'react-native-nitro-sound';

const SPLIT_INTERVAL = 60000; // 1 minute in milliseconds

export default function App() {
  const [recordSecs, setRecordSecs] = React.useState(0);
  const [recordTime, setRecordTime] = React.useState('00:00:00');
  const [isRecording, setIsRecording] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [recordings, setRecordings] = React.useState([]);
  const [currentPosition, setCurrentPosition] = React.useState(0);
  const [totalDuration, setTotalDuration] = React.useState(0);
  const [playTime, setPlayTime] = React.useState('00:00:00');
  const [duration, setDuration] = React.useState('00:00:00');
  const [mainRecordingId, setMainRecordingId] = React.useState(null);
  const [splitTimerRef, setSplitTimerRef] = React.useState(null);
  
const onStartRecord = async () => {
  Sound.addRecordBackListener(async(e) => {
    console.log('Recording progress:', e.currentPosition, e.currentMetering);
    setRecordSecs(e.currentPosition);
    setRecordTime(Sound.mmssss(Math.floor(e.currentPosition)));
    if (e?.currentPosition >= SPLIT_INTERVAL) {
      try {
      // save the split chunk
      await onStopRecordWithSave(Sound.mmssss(Math.floor(e.currentPosition)));

      // Restart recording immediately so recording continues across splits.
      // For proper background continuation when the app is minimized you should
      // also register a background task with expo-background-task in your app entrypoint
      // (BackgroundTask.defineTask(...)) and ensure OS background audio permissions/modes are enabled.
      await Sound.startRecorder();
      // re-attach lightweight listener (UI won't update while fully backgrounded,
      // but this keeps the native recorder callbacks alive)
      Sound.addRecordBackListener((ev) => {
        setRecordSecs(ev.currentPosition);
        setRecordTime(Sound.mmssss(Math.floor(ev.currentPosition)));
      });
      } catch (err) {
      console.warn('Auto-split restart failed', err);
      }
    }
  });

  const result = await Sound.startRecorder();
  console.log('Recording started:', result);
};

const handleAutoSplit = useCallback(async() => {
  const result = await Sound.stopRecorder();
  Sound.removeRecordBackListener();

  const id = Date.now();
  const newRecording = {
    id: id,
    name: `${mainRecordingId ? 'Sub-' : ''}Recording-${Math.random().toString(36).substr(2, 9)}`,
    uri: result,
    duration: recordTime,
    parentId: mainRecordingId,
    isSubnote: !!mainRecordingId,
  };

  const updatedRecordings = [...recordings];
  const parentIndex = updatedRecordings.findIndex((r) => r.id === mainRecordingId);

  if (parentIndex !== -1) {
    // Add as subnote to existing main recording
    updatedRecordings[parentIndex].subnotes = [
      ...(updatedRecordings[parentIndex].subnotes || []),
      newRecording,
    ];
  } else {
    // First split - create main note
    updatedRecordings.push(newRecording);
    setMainRecordingId(id);
  }

  await saveRecordings(updatedRecordings);
  setRecordSecs(0);
  setRecordTime('00:00:00');

  // Resume recording
  Sound.addRecordBackListener((e) => {
    setRecordSecs(e.currentPosition);
    setRecordTime(Sound.mmssss(Math.floor(e.currentPosition)));
  });
  await Sound.startRecorder();
},[mainRecordingId, recordings,Sound,recordTime]);


  const onStartPlay = async (uri) => {
    Sound.addPlayBackListener((e) => {
      setCurrentPosition(e.currentPosition);
      setTotalDuration(e.duration);
      setPlayTime(Sound.mmssss(Math.floor(e.currentPosition)));
      setDuration(Sound.mmssss(Math.floor(e.duration)));
    });

    Sound.addPlaybackEndListener((e) => {
      setIsPlaying(false);
      setCurrentPosition(0);
    });

    await Sound.startPlayer(uri);
    setIsPlaying(true);
  };

  const onStopPlay = async () => {
    Sound.stopPlayer();
    Sound.removePlayBackListener();
    Sound.removePlaybackEndListener();
  };

  const onPress = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message: 'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          if (isRecording) {
            onStopRecordWithSave(); 
          } else {
           onStartRecord();
          }
          setIsRecording(!isRecording);
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const onStopRecordWithSave = async (time=0) => {
    if (splitTimerRef) clearInterval(splitTimerRef);

    const result = await Sound.stopRecorder();
    Sound.removeRecordBackListener();
    const id = Date.now();
    const finalRecording = {
      id: id,
      name: `${mainRecordingId?'Sub-':''}Recording-${Math.random().toString(36).substr(2, 9)}`,
      uri: result,
      duration: time!=0?time:recordTime,
      parentId: mainRecordingId??null,
      isSubnote: !!mainRecordingId,
      subnotes: [],
    };

    const updatedRecordings = [...(recordings??[])];
    const parentIndex = updatedRecordings.findIndex((r) => r.id === mainRecordingId);

    if (parentIndex !== -1) {
      updatedRecordings[parentIndex].subnotes = [
        ...(updatedRecordings[parentIndex].subnotes || []),
        finalRecording,
      ];
    }else{
      updatedRecordings.push(finalRecording);
    }

    await saveRecordings(updatedRecordings);
    setRecordSecs(0);
    setRecordTime('00:00:00');
    if(time!=0){
      onStartRecord();
    }
    setMainRecordingId(time!=0?id:null);
  };

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const data = await AsyncStorage.getItem('recordings');
      if (data) setRecordings(JSON.parse(data));
    } catch (err) {
      console.log('Error loading recordings:', err);
    }
  };

  const saveRecordings = async (updatedRecordings) => {
    try {
      await AsyncStorage.setItem('recordings', JSON.stringify(updatedRecordings));
      setRecordings(updatedRecordings);
    } catch (err) {
      console.log('Error saving recordings:', err);
    }
  };

  const renderSubnotes = (subnotes) => {
    if (!subnotes || subnotes.length === 0) return null;

    return (
      <View style={{ marginLeft: 20, marginTop: 10 }}>
        {subnotes.map((subnote) => (
          <View key={subnote.id} style={{ padding: 8, backgroundColor: '#f0f0f0', marginBottom: 8, borderRadius: 4 }}>
            <Text style={{ fontSize: 12, fontStyle: 'italic' }}>{subnote.name}</Text>
            <Text style={{ fontSize: 10, color: '#666' }}>{subnote.duration}</Text>
            <Button
              onPress={isPlaying ? onStopPlay : () => onStartPlay(subnote?.uri)}
              title={isPlaying ? 'Stop' : 'Play'}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 1 }}>
            <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
            <Text>{item.duration}</Text>
            <Button
              onPress={isPlaying ? onStopPlay : () => onStartPlay(item?.uri)}
              title={isPlaying ? 'Stop' : 'Play'}
            />
            {renderSubnotes(item.subnotes)}
          </View>
        )}
      />
      <View style={{ marginTop: 20, position: 'absolute', bottom: 50, gap: 10, alignItems: 'center' }}>
        <Button
          onPress={onPress}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        />
        <Text>{recordTime}</Text>
        <Button
          onPress={async()=> AsyncStorage.removeItem('recordings').then(()=>setRecordings([]))}
          title={'clear recordings'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 60
  },
});
