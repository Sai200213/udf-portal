# Snyk Security Vulnerability Report

This report lists the third-party package dependencies vulnerabilities detected by the Snyk scan, matching the target list from the dashboard screenshot.

## 📊 Project Severity Summary

| Target / Project | Critical | High | Medium | Low | Package Manager |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **package-lock.json** | 9 | 55 | 88 | 0 | npm |
| **functions\package-lock.json** | 6 | 30 | 62 | 0 | npm |
| **mobile-admin\package-lock.json** | 0 | 12 | 0 | 0 | npm |
| **mobile-admin\android\build.gradle** | 0 | 0 | 0 | 0 | gradle |
| **mobile-admin\android\app\build.gradle** | 0 | 63 | 58 | 23 | gradle |
| **node_modules\@capacitor\android\capacitor\build.gradle** | 0 | 63 | 58 | 23 | gradle |
| **mobile-admin\android\capacitor-cordova-android-plugins\build.gradle** | 0 | 63 | 58 | 17 | gradle |
| **mobile-admin\node_modules\@codetrix-studio\capacitor-google-auth\android\build.gradle** | 0 | 63 | 63 | 23 | gradle |
| **mobile-employee\package-lock.json** | 0 | 12 | 0 | 0 | npm |
| **mobile-employee\android\build.gradle** | 0 | 0 | 0 | 0 | gradle |
| **mobile-employee\android\app\build.gradle** | 0 | 63 | 58 | 23 | gradle |
| **node_modules\@capacitor\android\capacitor\build.gradle** | 0 | 63 | 58 | 23 | gradle |
| **mobile-employee\android\capacitor-cordova-android-plugins\build.gradle** | 0 | 63 | 58 | 17 | gradle |
| **mobile-employee\node_modules\@codetrix-studio\capacitor-google-auth\android\build.gradle** | 0 | 63 | 63 | 23 | gradle |

---

## 🔍 Critical & High Vulnerabilities Breakdown

### 📁 package-lock.json
*Total: 9 Critical, 55 High, 88 Medium, 0 Low*

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `brace-expansion`
*   **Vulnerability ID:** [SNYK-JS-BRACEEXPANSION-16755174](>=5.0.2 <5.0.6)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > @capacitor/cli@8.3.0 > rimraf@6.1.3 > glob@13.0.6 > minimatch@10.2.5 > brace-expansion@5.0.5`
*   **Fix Action:** Upgrade brace-expansion@5.0.5 to false or @capacitor/cli@8.3.0 or rimraf@6.1.3 or glob@13.0.6 or minimatch@10.2.5 or brace-expansion@5.0.6
*   **Details:** ## Overview [brace-expansion](https://github.com/juliangruber/brace-expansion) is a Brace expansion as known from sh/bash  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `max` option being applied after generating all elements in ...

#### 🔴 **CRITICAL**: Arbitrary Code Injection in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16094665](>=6.8.0 <6.11.6,>=7.0.0 <7.5.5,>=8.0.0-experimental <8.0.1)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > firebase-admin@12.7.0 > @google-cloud/firestore@7.11.6 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-admin@12.7.0 or @google-cloud/firestore@7.11.6 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Arbitrary Code Injection through the handling of user-supplied protobuf definitions, specifically via the Type's `name` field. An ...

#### 🟠 **HIGH**: Uncontrolled Recursion in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643262](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > firebase-admin@12.7.0 > @google-cloud/firestore@7.11.6 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-admin@12.7.0 or @google-cloud/firestore@7.11.6 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Uncontrolled Recursion through unbounded recursion when decoding nested message fields. An attacker can exhaust the call stack and...

#### 🟠 **HIGH**: Prototype Pollution in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643304](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > firebase-admin@12.7.0 > @google-cloud/firestore@7.11.6 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-admin@12.7.0 or @google-cloud/firestore@7.11.6 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Prototype Pollution in the code generation. An attacker who has achieved prototype pollution by a different exploit can execute ar...

#### 🟠 **HIGH**: Arbitrary Code Injection in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643421](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > firebase-admin@12.7.0 > @google-cloud/firestore@7.11.6 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-admin@12.7.0 or @google-cloud/firestore@7.11.6 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Arbitrary Code Injection in the `toObject` function when handling a schema-controlled `bytes` field default value. An attacker can...

#### 🟠 **HIGH**: Arbitrary Code Injection in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643442](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > firebase-admin@12.7.0 > @google-cloud/firestore@7.11.6 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-admin@12.7.0 or @google-cloud/firestore@7.11.6 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Arbitrary Code Injection via the `pbjs` static code generation. An attacker can execute arbitrary code by providing crafted schema...

#### 🟠 **HIGH**: Arbitrary Code Injection in `@protobufjs/utf8`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJSUTF8-16643422](<1.1.1)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > firebase-admin@12.7.0 > @google-cloud/firestore@7.11.6 > protobufjs@7.5.4 > @protobufjs/utf8@1.1.0`
*   **Fix Action:** Upgrade @protobufjs/utf8@1.1.0 to false or firebase-admin@12.7.0 or @google-cloud/firestore@7.11.6 or protobufjs@7.6.1 or @protobufjs/utf8@1.1.1
*   **Details:** ## Overview  Affected versions of this package are vulnerable to Arbitrary Code Injection in the `toObject` function when handling a schema-controlled `bytes` field default value. An attacker can execute arbitrary JavaScript code by providing a crafted descriptor with a malicious default value for a...

#### 🟠 **HIGH**: Regular Expression Denial of Service (ReDoS) in `xlsx`
*   **Vulnerability ID:** [SNYK-JS-XLSX-6252523](*)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > xlsx@0.18.5`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [xlsx](https://sheetjs.com) is a Parser and writer for various spreadsheet formats.  Affected versions of this package are vulnerable to Regular Expression Denial of Service (ReDoS) in multiple functions, allowing an attacker to crash the system by submitting specially crafted input.  ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16133132](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > @capacitor/cli@8.3.0 > plist@3.1.0 > @xmldom/xmldom@0.8.12`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.12 to false or @capacitor/cli@8.3.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: Uncontrolled Recursion in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134530](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > @capacitor/cli@8.3.0 > plist@3.1.0 > @xmldom/xmldom@0.8.12`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.12 to false or @capacitor/cli@8.3.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134549](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > @capacitor/cli@8.3.0 > plist@3.1.0 > @xmldom/xmldom@0.8.12`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.12 to false or @capacitor/cli@8.3.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134552](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `hr-portal-udf@1.0.0-rc1 > @capacitor/cli@8.3.0 > plist@3.1.0 > @xmldom/xmldom@0.8.12`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.12 to false or @capacitor/cli@8.3.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

### 📁 functions\package-lock.json
*Total: 6 Critical, 30 High, 62 Medium, 0 Low*

#### 🔴 **CRITICAL**: Arbitrary Code Injection in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16094665](>=6.8.0 <6.11.6,>=7.0.0 <7.5.5,>=8.0.0-experimental <8.0.1)
*   **Introduced via:** `functions@* > firebase-functions@7.2.3 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-functions@7.2.3 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Arbitrary Code Injection through the handling of user-supplied protobuf definitions, specifically via the Type's `name` field. An ...

#### 🟠 **HIGH**: Uncontrolled Recursion in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643262](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `functions@* > firebase-functions@7.2.3 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-functions@7.2.3 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Uncontrolled Recursion through unbounded recursion when decoding nested message fields. An attacker can exhaust the call stack and...

#### 🟠 **HIGH**: Prototype Pollution in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643304](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `functions@* > firebase-functions@7.2.3 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-functions@7.2.3 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Prototype Pollution in the code generation. An attacker who has achieved prototype pollution by a different exploit can execute ar...

#### 🟠 **HIGH**: Arbitrary Code Injection in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643421](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `functions@* > firebase-functions@7.2.3 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-functions@7.2.3 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Arbitrary Code Injection in the `toObject` function when handling a schema-controlled `bytes` field default value. An attacker can...

#### 🟠 **HIGH**: Arbitrary Code Injection in `protobufjs`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJS-16643442](<7.5.6,>=8.0.0-experimental <8.0.2)
*   **Introduced via:** `functions@* > firebase-functions@7.2.3 > protobufjs@7.5.4`
*   **Fix Action:** Upgrade protobufjs@7.5.4 to false or firebase-functions@7.2.3 or protobufjs@7.6.1
*   **Details:** ## Overview [protobufjs](https://github.com/dcodeIO/protobuf.js) is a protocol buffer for JavaScript (& TypeScript).  Affected versions of this package are vulnerable to Arbitrary Code Injection via the `pbjs` static code generation. An attacker can execute arbitrary code by providing crafted schema...

#### 🟠 **HIGH**: Arbitrary Code Injection in `@protobufjs/utf8`
*   **Vulnerability ID:** [SNYK-JS-PROTOBUFJSUTF8-16643422](<1.1.1)
*   **Introduced via:** `functions@* > firebase-functions@7.2.3 > protobufjs@7.5.4 > @protobufjs/utf8@1.1.0`
*   **Fix Action:** Upgrade @protobufjs/utf8@1.1.0 to false or firebase-functions@7.2.3 or protobufjs@7.6.1 or @protobufjs/utf8@1.1.1
*   **Details:** ## Overview  Affected versions of this package are vulnerable to Arbitrary Code Injection in the `toObject` function when handling a schema-controlled `bytes` field default value. An attacker can execute arbitrary JavaScript code by providing a crafted descriptor with a malicious default value for a...

### 📁 mobile-admin\package-lock.json
*Total: 0 Critical, 12 High, 0 Medium, 0 Low*

#### 🟠 **HIGH**: Infinite loop in `brace-expansion`
*   **Vulnerability ID:** [SNYK-JS-BRACEEXPANSION-15789759](<1.1.13,>=2.0.0 <2.0.3,>=3.0.0 <3.0.2,>=4.0.0 <5.0.5)
*   **Introduced via:** `udf-hrms-admin@1.0.0 > @capacitor/cli@8.2.0 > rimraf@6.1.3 > glob@13.0.6 > minimatch@10.2.4 > brace-expansion@5.0.4`
*   **Fix Action:** Upgrade brace-expansion@5.0.4 to false or @capacitor/cli@8.2.0 or rimraf@6.1.3 or glob@13.0.6 or minimatch@10.2.5 or brace-expansion@5.0.6
*   **Details:** ## Overview [brace-expansion](https://github.com/juliangruber/brace-expansion) is a Brace expansion as known from sh/bash  Affected versions of this package are vulnerable to Infinite loop through the `expand` function when processing a brace pattern with a zero step value. An attacker can cause the...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `brace-expansion`
*   **Vulnerability ID:** [SNYK-JS-BRACEEXPANSION-16755174](>=5.0.2 <5.0.6)
*   **Introduced via:** `udf-hrms-admin@1.0.0 > @capacitor/cli@8.2.0 > rimraf@6.1.3 > glob@13.0.6 > minimatch@10.2.4 > brace-expansion@5.0.4`
*   **Fix Action:** Upgrade brace-expansion@5.0.4 to false or @capacitor/cli@8.2.0 or rimraf@6.1.3 or glob@13.0.6 or minimatch@10.2.5 or brace-expansion@5.0.6
*   **Details:** ## Overview [brace-expansion](https://github.com/juliangruber/brace-expansion) is a Brace expansion as known from sh/bash  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `max` option being applied after generating all elements in ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-15869636](<0.8.12,>=0.9.0 <0.9.9)
*   **Introduced via:** `udf-hrms-admin@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16133132](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-hrms-admin@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: Uncontrolled Recursion in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134530](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-hrms-admin@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134549](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-hrms-admin@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134552](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-hrms-admin@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

### 📁 mobile-admin\android\app\build.gradle
*Total: 0 Critical, 63 High, 58 Medium, 23 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/app@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/app@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/app@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

### 📁 node_modules\@capacitor\android\capacitor\build.gradle
*Total: 0 Critical, 63 High, 58 Medium, 23 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/capacitor-android@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/capacitor-android@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

### 📁 mobile-admin\android\capacitor-cordova-android-plugins\build.gradle
*Total: 0 Critical, 63 High, 58 Medium, 17 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

### 📁 mobile-admin\node_modules\@codetrix-studio\capacitor-google-auth\android\build.gradle
*Total: 0 Critical, 63 High, 63 Medium, 23 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

### 📁 mobile-employee\package-lock.json
*Total: 0 Critical, 12 High, 0 Medium, 0 Low*

#### 🟠 **HIGH**: Infinite loop in `brace-expansion`
*   **Vulnerability ID:** [SNYK-JS-BRACEEXPANSION-15789759](<1.1.13,>=2.0.0 <2.0.3,>=3.0.0 <3.0.2,>=4.0.0 <5.0.5)
*   **Introduced via:** `udf-employee@1.0.0 > @capacitor/cli@8.2.0 > rimraf@6.1.3 > glob@13.0.6 > minimatch@10.2.4 > brace-expansion@5.0.4`
*   **Fix Action:** Upgrade brace-expansion@5.0.4 to false or @capacitor/cli@8.2.0 or rimraf@6.1.3 or glob@13.0.6 or minimatch@10.2.5 or brace-expansion@5.0.6
*   **Details:** ## Overview [brace-expansion](https://github.com/juliangruber/brace-expansion) is a Brace expansion as known from sh/bash  Affected versions of this package are vulnerable to Infinite loop through the `expand` function when processing a brace pattern with a zero step value. An attacker can cause the...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `brace-expansion`
*   **Vulnerability ID:** [SNYK-JS-BRACEEXPANSION-16755174](>=5.0.2 <5.0.6)
*   **Introduced via:** `udf-employee@1.0.0 > @capacitor/cli@8.2.0 > rimraf@6.1.3 > glob@13.0.6 > minimatch@10.2.4 > brace-expansion@5.0.4`
*   **Fix Action:** Upgrade brace-expansion@5.0.4 to false or @capacitor/cli@8.2.0 or rimraf@6.1.3 or glob@13.0.6 or minimatch@10.2.5 or brace-expansion@5.0.6
*   **Details:** ## Overview [brace-expansion](https://github.com/juliangruber/brace-expansion) is a Brace expansion as known from sh/bash  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `max` option being applied after generating all elements in ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-15869636](<0.8.12,>=0.9.0 <0.9.9)
*   **Introduced via:** `udf-employee@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16133132](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-employee@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: Uncontrolled Recursion in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134530](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-employee@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134549](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-employee@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

#### 🟠 **HIGH**: XML Injection in `@xmldom/xmldom`
*   **Vulnerability ID:** [SNYK-JS-XMLDOMXMLDOM-16134552](<0.8.13,>=0.9.0 <0.9.10)
*   **Introduced via:** `udf-employee@1.0.0 > @capacitor/cli@8.2.0 > plist@3.1.0 > @xmldom/xmldom@0.8.11`
*   **Fix Action:** Upgrade @xmldom/xmldom@0.8.11 to false or @capacitor/cli@8.2.0 or plist@3.1.1 or @xmldom/xmldom@0.9.10
*   **Details:** ## Overview [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) is a javascript ponyfill to provide the following APIs that are present in modern browsers to other runtimes. Since version 0.7.0 this package is published to npm as @xmldom/xmldom and no longer as xmldom  Affected versions ...

### 📁 mobile-employee\android\app\build.gradle
*Total: 0 Critical, 63 High, 58 Medium, 23 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/app@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/app@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/app@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/app@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

### 📁 node_modules\@capacitor\android\capacitor\build.gradle
*Total: 0 Critical, 63 High, 58 Medium, 23 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/capacitor-android@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-android@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/capacitor-android@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

### 📁 mobile-employee\android\capacitor-cordova-android-plugins\build.gradle
*Total: 0 Critical, 63 High, 58 Medium, 17 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/capacitor-cordova-android-plugins@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

### 📁 mobile-employee\node_modules\@codetrix-studio\capacitor-google-auth\android\build.gradle
*Total: 0 Critical, 63 High, 63 Medium, 23 Low*

#### 🟠 **HIGH**: Stack-based Buffer Overflow in `com.google.protobuf:protobuf-java`
*   **Vulnerability ID:** [SNYK-JAVA-COMGOOGLEPROTOBUF-8055227]([,3.25.5),[4.0.0-rc-1,4.27.5),[4.28.0-RC1,4.28.2))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.google.testing.platform:android-driver-instrumentation@0.0.9-alpha03 > com.google.protobuf:protobuf-java@3.24.4`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [com.google.protobuf:protobuf-java](https://mvnrepository.com/artifact/com.google.protobuf/protobuf-java) is a Google's language-neutral, platform-neutral, extensible mechanism for serializing structured data.  Affected versions of this package are vulnerable to Stack-based Buffer Overfl...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-11799531]([,4.1.124.Final),[4.2.0.Alpha1,4.2.4.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the improper handling...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485151]([,4.1.125.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) via the `BrotliDe...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789758]([,4.1.132.Final),[4.2.0.Alpha1,4.2.10.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling through the `verifyContinuati...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438929]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpConte...

#### 🟠 **HIGH**: Denial of Service (DoS) in `io.netty:netty-codec-http2`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-5953332]([,4.1.100.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http2](http://netty.io/) is a HTTP2 sub package for the netty library, an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Denial of Service (DoS) in the implementation of the HTTP/2 protocol. An attacker ...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485149]([,4.1.125.Final),[4.2.0.Alpha1,4.2.5.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling via ...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-12485150]([,4.1.125.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to Improper Handling of Highly...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-15789756]([,4.1.132.Final),[4.2.0.Alpha1,4.2.12.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438737]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling when...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438923]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: HTTP Request Smuggling in `io.netty:netty-codec-http`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438934]([,4.1.133.Final),[4.2.0.Alpha1,4.2.13.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec-http@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec-http](https://mvnrepository.com/artifact/io.netty/netty-codec-http) is a network application framework for rapid development of maintainable high performance protocol servers & clients.  Affected versions of this package are vulnerable to HTTP Request Smuggling in t...

#### 🟠 **HIGH**: Allocation of Resources Without Limits or Throttling in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438322]([,4.1.133.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Allocation of Resources Without Limits or Throttling in the `Lz4FrameDecoder` component. An attacker can cause excess...

#### 🟠 **HIGH**: Improper Handling of Highly Compressed Data (Data Amplification) in `io.netty:netty-codec`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-16438930]([,4.1.133.Final))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.android.tools.utp:android-test-plugin-result-listener-gradle@31.13.0 > io.grpc:grpc-netty@1.69.1 > io.netty:netty-codec-http2@4.1.110.Final > io.netty:netty-codec@4.1.110.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-codec](https://github.com/netty/netty) is an event-driven asynchronous network application framework.  Affected versions of this package are vulnerable to Improper Handling of Highly Compressed Data (Data Amplification) in the `HttpContentDecompressor` and `DelegatingDeco...

#### 🟠 **HIGH**: Improper Validation of Specified Quantity in Input in `io.netty:netty-handler`
*   **Vulnerability ID:** [SNYK-JAVA-IONETTY-8707739]([4.1.91.Final,4.1.118.Final),[4.2.0.Alpha1,4.2.0.RC3))
*   **Introduced via:** `android/codetrix-studio-capacitor-google-auth@unspecified > com.google.testing.platform:core@0.0.9-alpha03 > io.grpc:grpc-netty@1.57.2 > io.netty:netty-codec-http2@4.1.93.Final > io.netty:netty-handler@4.1.93.Final`
*   **Fix Action:** No direct patch available
*   **Details:** ## Overview [io.netty:netty-handler](https://github.com/netty/netty.git/netty-handler) is a library that provides an asynchronous event-driven network application framework and tools for rapid development of maintainable high performance and high scalability protocol servers and clients. In other wo...

