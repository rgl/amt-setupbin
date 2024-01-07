import fs from "fs";
import { program } from "commander";
import CreateAmtSetupBinStack from "./amt-setupbin.cjs";
const { AmtSetupBinVarIds, AmtSetupBinCreate, AmtSetupBinEncode, AmtSetupBinDecode } = CreateAmtSetupBinStack();

function log(message) {
    console.log(`${new Date().toISOString()} ${message}`);
}

const AmtSetupBinVariableTypes = {
    0: "String",
    1: "Int8",
    2: "Int16",
    3: "Int32",
    4: "GUID",
};

const AmtSetupBinVariables = createAmtSetupBinVariables();

function createAmtSetupBinVariables() {
    const variables = {};
    for (const [moduleId, moduleVariables] of Object.entries(AmtSetupBinVarIds)) {
        for (const [variableId, variable] of Object.entries(moduleVariables)) {
            const variableName = variable[1];
            if (variables.hasOwnProperty(variableName)) {
                throw Error(`cannot add duplicate variable ${variableName}`);
            }
            if (!AmtSetupBinVariableTypes.hasOwnProperty(variable[0])) {
                throw Error(`unknown variable ${variableName} type ${variable[0]}`);
            }
            variables[variableName] = {
                moduleId: parseInt(moduleId, 10),
                id: parseInt(variableId, 10),
                type: AmtSetupBinVariableTypes[variable[0]],
                domain: variable[2],
            };
        }
    }
    return variables;
}

function readAmtSetupBinFile(setupBinPath) {
    const data = fs.readFileSync(setupBinPath, "binary");
    return readAmtSetupBin(data);
}

function writeAmtSetupBin(setupBinPath, variables) {
    const data = createAmtSetupBin(variables);
    fs.writeFileSync(setupBinPath, data, "binary");
}

async function writeAmtSetupBinImg(setupBinPath, setupBinImgPath) {
    const p = Bun.spawn([
        "amt-setupbin-img",
        `-path=${setupBinPath}`,
        `-img-path=${setupBinImgPath}`
    ], {
        stdin: null,
        stdout: "inherit",
        stderr: "inherit",
    });
    try {
        const exitCode = await p.exited;
        if (exitCode !== 0) {
            throw Error(`amt-setupbin-img failed with exit code ${exitCode}`);
        }
    } finally {
        p.unref();
    }
}

function readAmtSetupBin(data) {
    const decoded = AmtSetupBinDecode(data);
    if (!decoded) {
        throw Error(`failed to load data from an unknown reason`);
    }
    if (decoded.fileType != 4) {
        throw Error(`only version 4 is supported`);
    }
    if (decoded.records.length != 1) {
        throw Error(`only a single record is supported`);
    }
    return decoded.records[0].variables.map(variable => [variable.desc, variable.value]);
}

function createAmtSetupBin(variables) {
    const recordVariables = variables.map(([name, value]) => {
        if (!AmtSetupBinVariables.hasOwnProperty(name)) {
            throw Error(`unknown variable name ${name}`);
        }
        const variable = AmtSetupBinVariables[name];
        return {
            moduleid: variable.moduleId,
            varid: variable.id,
            value: value,
        };
    });
    const setup = AmtSetupBinCreate(
        // 4: Version 4.
        4,
        // 1: Do not consume records.
        1);
    setup.records = [
        {
            typeIdentifier: 1,  // 0: Invalid, 1: Data Record.
            flags: 1 | 2,       // 1: Valid, 2: Scrambled.
            variables: recordVariables,
        },
    ];
    return AmtSetupBinEncode(setup);
}

async function main(options) {
    const setupBinVariables = [
        ["Current MEBx Password", options.currentPassword],
        ["New MEBx Password", options.newPassword],
        ["Manageability Feature Selection", 1], // 0: None, 1: Intel AMT.
        ["Power Package", "46732273-DC23-2F43-A98A-13D37982D855"], // 46732273-DC23-2F43-A98A-13D37982D855: Desktop ON in S0; ME Wake in S3, S4-S5.
        ["SOL/IDER Redirection Configuration", 7], // 7: SOL+IDER - User/Pass Enabled.
        ["DHCP", 2], // 1: Disabled, 2: Enabled.
        ["Shared/Dedicated FQDN", 1], // 0: Dedicated, 1: Shared.
        ["Remote Desktop (KVM) State", 1], // 0: Disabled, 1: Enabled.
        ["Opt-in User Consent Option", 0], // 0: Disabled, 1: Enabled.
        ["Opt-in Remote IT Consent Policy", 1], // 0: Disabled, 1: Enabled.
        //["Manual Setup and Configuration", 1], // 0: Automated, 1: Manual. // NB this no longer works with recent firmware.
    ];
    if (options.certificate) {
        // User Defined Certificate Addition:
        //      hash algo (1 byte): 1: SHA1 (20 bytes), 2: SHA256 (32 bytes), 3: SHA384 (48 bytes).
        //      hash (20 to 48 bytes).
        //      name length (1 byte).
        //      name (up to 32 bytes).
        const match = options.certificate.match(/^(?<hash>[a-fA-F0-9]{64}) (?<name>.+)$/);
        if (!match) {
            throw Error("--certificate value must be the certificate sha256 hex-encoded hash and the certificate name");
        }
        const certificateHash = match.groups.hash;
        const certificateName = match.groups.name;
        const userDefinedCertificate = String.fromCharCode(2) +
            Buffer.from(certificateHash, "hex").toString("binary") +
            String.fromCharCode(certificateName.length) +
            certificateName;
        setupBinVariables.push(["User Defined Certificate Addition", userDefinedCertificate]);
        // Disable pre-installed certificates.
        setupBinVariables.push(["Pre-Installed Certificates Enabled", 0]); // 0: Disabled, 1: Enabled.
    }
    if (options.pkiDnsSuffix) {
        // PKI DNS Suffix (up to 255 bytes).
        setupBinVariables.push(["PKI DNS Suffix", options.pkiDnsSuffix]);
    }

    log(`Creating the AMT Setup.bin file at ${options.path}...`);
    writeAmtSetupBin(options.path, setupBinVariables);

    if (options.debug) {
        log(`Reading the created AMT Setup.bin from ${options.path}...`);
        const setup = JSON.stringify(readAmtSetupBinFile(options.path), null, 2);
        log(`Dumping the created AMT Setup.bin...`);
        console.log(setup);
    }

    log(`Creating the AMT Setup.bin.img disk image file at ${options.path}.img...`);
    await writeAmtSetupBinImg(options.path, `${options.path}.img`);
}

program
    .option("--current-password <current-password>", "current AMT password", "admin")
    .option("--new-password <new-password>", "new AMT password", "HeyH0Password!")
    .option("--certificate <sha256 name>", "trusted certificate sha256 hex-encoded hash followed by the name", null)
    .option("--pki-dns-suffix <pki-dns-suffix>", "trusted pki dns suffix", null)
    .option("--path <path>", "AMT Setup.bin file path", "Setup.bin")
    .option("--debug", "enable debug mode", false)
    .parse(process.argv);

main(program.opts());
