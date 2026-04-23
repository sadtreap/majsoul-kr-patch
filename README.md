# 작혼 일섭 한국어 패치

작혼 일본 서버(`game.mahjongsoul.com`) 환경을 그대로 유지하면서, 화면의 언어만 **한국어**로 바꿔주는 유저 스크립트입니다.

- **접속 서버 / 계정:** 일본 서버 유지 (기존 계정 그대로 사용)
- **표시 언어:** 한국어 UI 및 리소스 적용

---

## 면책 조항 (설치 전 반드시 읽어주세요)

**이 스크립트는 게임사(Yostar, Cat Food Studio)에서 공식적으로 승인하거나 배포한 프로그램이 아닌, 개인이 제작한 비공식 패치입니다.**

- 이 스크립트는 게임 플레이 자체에는 전혀 개입하지 않고 화면의 글자만 바꿔줍니다.
- 하지만 게임사의 운영 정책에 따라 **비인가 프로그램(서드파티 프로그램) 사용으로 간주될 수 있으며, 이로 인해 계정 이용 제한(정지) 등의 불이익이 발생할 수 있는 잠재적인 위험**이 있습니다.
- **스크립트 사용으로 인해 발생하는 계정 정지, 데이터 손실 등 모든 문제에 대한 책임은 전적으로 사용자 본인에게 있으며, 제작자는 어떠한 책임도 지지 않습니다.**

위 내용을 충분히 인지하시고, 동의하시는 분만 본인의 판단하에 신중하게 사용해 주시기 바랍니다.

---

## 설치하기

복잡한 복사/붙여넣기 없이 클릭 몇 번으로 설치할 수 있습니다.

### **1. Tampermonkey 확장 프로그램 설치하기**
현재 사용 중인 브라우저에 Tampermonkey를 먼저 설치해 주세요.

- [Chrome용 다운로드](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Edge용 다운로드](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- [Firefox용 다운로드](https://addons.mozilla.org/ko/firefox/addon/tampermonkey)

### **2. 스크립트 설치하기**
Tampermonkey가 설치되었다면, 아래 링크를 클릭해 주세요.

> **[여기를 클릭하여 한국어 패치 설치하기](https://github.com/sadtreap/majsoul-kr-patch/raw/refs/heads/main/mahjongsoul-jp-kr.user.js)**

### **3. '설치' 버튼 누르기**
링크를 클릭하면 Tampermonkey 설치 화면이 나타납니다. 화면의 **[설치]** 버튼을 누르면 끝입니다!

### **4. 게임 접속하기**  
이제 [작혼 일본 서버](https://game.mahjongsoul.com)에 접속해 보세요. 화면이 한국어로 잘 나오면 성공입니다!

---

## 문제 해결 (개발자/고급 사용자용)

패치가 적용되었는지 콘솔(F12)에서 직접 확인하고 싶다면 아래 코드를 입력해 보세요.

```js
window.__mjsJpKrPatch?.version;
window.__mjsJpKrPatch?.stats;
```
