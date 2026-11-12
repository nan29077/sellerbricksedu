/** 강의 파일 업로드 (/api/upload 로 스트리밍) — 진행률 콜백 지원 */
export function uploadLessonFile(lessonId: string, kind: 'video' | 'file' | 'captions', file: File, onProgress?: (pct: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload?lessonId=${encodeURIComponent(lessonId)}&kind=${kind}&name=${encodeURIComponent(file.name)}`);
    xhr.withCredentials = true;
    const type = file.type || (/\.vtt$/i.test(file.name) ? 'text/vtt' : 'application/octet-stream');
    xhr.setRequestHeader('Content-Type', type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let j: any = {};
      try { j = JSON.parse(xhr.responseText); } catch { /* 빈 응답 */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(j);
      else reject(new Error(j.error || (xhr.status === 413 ? '파일이 너무 큽니다.' : `업로드 실패 (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new Error('네트워크 오류로 업로드하지 못했습니다.'));
    xhr.send(file);
  });
}
