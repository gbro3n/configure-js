// -------------------------------------------------------------------------------
// MIT License
// 
// Copyright (c) 2022 Gareth Brown
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// -------------------------------------------------------------------------------

// -------------------------------------------------------------------------------
// For custom software development and consulting contact mail@appsoftware.com
// -------------------------------------------------------------------------------

// -------------------------------------------------------------------------------
// Script recursively searches file tree for environment template
// files and replaces in variables for environment as indicated
// by data in top level .env file name.
// -------------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

const readline = require('readline');

String.prototype.toPascalCase = function () {
  return this.replace(new RegExp(/[-_]+/, 'g'), ' ')
    .replace(new RegExp(/[^\w\s]/, 'g'), '')
    .replace(new RegExp(/\s+(.)(\w+)/, 'g'), ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`)
    .replace(new RegExp(/\s/, 'g'), '')
    .replace(new RegExp(/\w/), (s) => s.toUpperCase());
};

String.prototype.replaceAllCaseInsensitive = function (strReplace, strWith) {
  // https://stackoverflow.com/questions/7313395/case-insensitive-replace-all
  var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  var reg = new RegExp(esc, 'ig');
  return this.replace(reg, strWith);
};

// Recursive search of file tree looking for files matching environment template
// patterns.

let allEnvKeys = [];
let fileEnvKeyWarnings = [];

var recurseFindEnvTemplates = function (dir, environmentName, envVariables) {

    // Read a file list syncronously

    const list = fs.readdirSync(dir);

    list.forEach(function (filePath, i) {
      filePath = path.resolve(dir, filePath);

      let info = fs.statSync(filePath);

      if (info && info.isDirectory()) {
        recurseFindEnvTemplates(filePath, environmentName, envVariables);
      } else {
        let fileName = path.basename(filePath);
        let directoryName = path.dirname(filePath);

        let isMatch = /\.envt$/.test(fileName);

        if (isMatch) {
          console.log(`Result: ${filePath} ${i}`);

          let outputFileNameEnvString;

          let outputFileName = fileName;

          if (fileName.includes('.Env.')) {
            outputFileNameEnvString = environmentName.toPascalCase();
          } else if (fileName.includes('.env.')) {
            outputFileNameEnvString = environmentName.toLowerCase();
          } else if (fileName.includes('.ENV.')) {
            outputFileNameEnvString = environmentName.toUpperCase();
          } else {
            // No environment name in file path, but this is not necessarily an error
          }

          // Replace file extension first - that way if target output file extension is .env
          // we don't inadvertently replace with environment name if not intended.

          outputFileName = outputFileName.replace('.envt', '');
          outputFileName = outputFileName.replaceAllCaseInsensitive('.env.', `.${outputFileNameEnvString}.`);

          console.log(`Generated file name: ${outputFileName}`);

          let templateText = fs.readFileSync(filePath, 'utf8');

          // Search for all env keys in current file and track number of times replaced

          let envKeysRegex = /\$\{([A-Z_]+)\}/g;

          const fileEnvKeysMatchArray = [...templateText.matchAll(envKeysRegex)];

          let fileEnvKeys = [];

          fileEnvKeysMatchArray.forEach(function(val, i) {
          
            if(!fileEnvKeys.some(e => e.key === val[1]))
            {
                fileEnvKeys.push({
                    key: val[1],
                    count: 0
                });
            }
          });

          for (let i = 0; i < envVariables.length; i++) {
            // Need to replace all instances, not just first. Regex version
            // was fiddly with ${} template string, so use while loop.

            const findKeyTemplate = '${' + envVariables[i].key + '}';

            // Replace text in string and track number of times replaced, globally and in current file

            let replaceInstancesLocal = 0;

            while (templateText.includes(findKeyTemplate)) {

              // .replace runs only for first instance found so run until no further instances found       

              templateText = templateText.replace(findKeyTemplate, envVariables[i].value);

              replaceInstancesLocal++;
            }

            if(!allEnvKeys.some(e => e.key === envVariables[i].key))
            {
                allEnvKeys.push({
                    key: envVariables[i].key,
                    count: replaceInstancesLocal
                })
            }
            else
            {
                allEnvKeys.filter(e => e.key === envVariables[i].key)[0].count += replaceInstancesLocal; 
            }

            var matchingFileEnvKeys = fileEnvKeys.filter(e => e.key === envVariables[i].key);

            if(matchingFileEnvKeys.length > 0)
            {
                // Should not be more than 0

                matchingFileEnvKeys[0].count += replaceInstancesLocal;
            }
          }

          // Where any env keys were not replaced in currenyt file, add a warning

          fileEnvKeys.filter(e => e.count === 0).forEach(function(nonReplacedEnvKey, it) {

            fileEnvKeyWarnings.push({
                key: nonReplacedEnvKey.key,
                filePath: filePath
            });
          });


          console.log(templateText);

          fs.writeFileSync(directoryName + '/' + outputFileName, templateText);
        }
      }
    });
};

// Execute, read args (first 2 are 'node', path and can be ignored)

const argsArray = process.argv.slice(2);

if (argsArray.length === 1) {
  const envVariablesFileName = argsArray[0];

  if (envVariablesFileName.endsWith('.env')) {

    // Environment variable files have extension '.env'. Replace
    // the extension to get environment name - the part of the file name
    // preceeding the extension will be used as the environment name for
    // naming output files if the .envt filename contains environment name
    // replace pattern.

    const environmentName = envVariablesFileName.replace('.env', '');

    // Read environment variable file and split into line data

    const envVariablesFileText = fs.readFileSync(`./${envVariablesFileName}`, 'utf8');

    const lineTextArray = envVariablesFileText.split(/\r?\n/);

    let envVariables = [];

    for (let i = 0; i < lineTextArray.length; i++) {
      let lineText = lineTextArray[i];

      if (lineText) {
        lineText = lineText.trim();

        // Check line is not empty

        if (lineText.length > 0) {
          // Check line is not comment

          if (!lineText.startsWith('#')) {
              
            // Split on first occurence of =

            let lineVariables = lineText.split('=');

            // Check length following split. Treat single item array
            // as value with empty string, otherwise take raw value as item for replace in.
            // No JSON encode is attempted, we want to replace raw string. This means that strings
            // with chars with special meanings in JSON will need to be manually escaped in
            // environment variable files, but allows for array strings etc to be replaced in
            // where required.

            console.log(lineVariables)

            var envVariable;

            if (lineVariables.length === 1) {

              // Have key, no value      

              envVariable = {
                key: lineVariables[0],
                value: '',
              };
            } else if (lineVariables.length === 2) {

              // Standard key value

              envVariable = {
                key: lineVariables[0],
                value: lineVariables[1],
              };  
            } else {

              // Value contains '=' char. Take the portion after the key
              // and rejoin      

              envVariable = {  
                key: lineVariables[0],
                value: lineVariables.slice(1).join('=')
              };
            }

            // Remove existing array items of same value so that
            // later entries take precedence 

            envVariables = envVariables.filter(function(obj) {
                return obj.key !== envVariable.key;
            });

            envVariables.push(envVariable);
          }
        }
      }
    }

    recurseFindEnvTemplates('.', environmentName, envVariables);

    // Log out any warnings in yellow

    const nonReplacedKeys = allEnvKeys.filter(e => e.count === 0);

    if(nonReplacedKeys.length > 0)
    {
        nonReplacedKeys.forEach(function (key, i) {

            console.log('\x1b[33m%s\x1b[0m', `WARNING: No replace template found in any file for: ${key.key}`);
        });
    }

    if(fileEnvKeyWarnings.length > 0)
    {
        fileEnvKeyWarnings.forEach(function (fileKeyWarning, i) {

            console.log('\x1b[33m%s\x1b[0m', `WARNING: No environment variable found ${fileKeyWarning.key} (${fileKeyWarning.filePath})`);
        });
    }

  } else {
    throw "Error: Environment variables configuration file is expected to have '.env' extension.";
  }
} else {
  throw 'Error: Environment variables configuration file is required at arg[0].';
}