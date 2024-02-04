# About

[![Build status](https://github.com/rgl/amt-setupbin/workflows/build/badge.svg)](https://github.com/rgl/amt-setupbin/actions?query=workflow%3Abuild)

This facilitates the bootstrap of a [OpenAMT Cloud Toolkit](https://github.com/open-amt-cloud-toolkit/open-amt-cloud-toolkit) sandbox by creating a private AMT provisioning certificate and AMT configuration file.

This creates:

* A private AMT CA for the `amt.test` AMT domain.
* The AMT domain provisioning certificate.
* The `Setup.bin` AMT configuration file.
* The `Setup.bin.img` USB key disk image with the AMT configuration file.

# Usage

Install `openssl`.

Install `docker` and `docker compose`.

Configure your network to resolve the `mps.amt.test` domain to your local
machine IP address.

Clone the [open-amt-cloud-toolkit repository](https://github.com/open-amt-cloud-toolkit/open-amt-cloud-toolkit).

Copy the `.env.template` file to the `.env` file.

Open the `.env` file and set/modify the following variables:

```conf
MPS_COMMON_NAME=mps.amt.test
MPS_WEB_ADMIN_USER=standalone
MPS_WEB_ADMIN_PASSWORD=G@ppm0ym
MPS_JWT_SECRET=Yq3t6w9z6CbE3HRMcQfTjWnZr4u7x6AJ
POSTGRES_PASSWORD=postgresadmin
VAULT_TOKEN=root
```

For more information see https://open-amt-cloud-toolkit.github.io/docs/2.17/Reference/architectureOverview/#passwords.

Start OpenAMT in foreground:

```bash
docker compose up
```

Create the AMT CA, the AMT provisioning certificate, and the `Setup.bin` AMT configuration file:

```bash
./create-provisioning-certificate.sh
```

**NB** View/Change the passwords at the top of the [`create-provisioning-certificate.sh` file](create-provisioning-certificate.sh).

Create the [new `amt.test` OpenAMT Domain](https://mps.amt.test/domains/new) and import the `amt-ca/amt.test.pfx` file.

Burn the `amt-ca/Setup.bin.img` disk image into a USB key, or copy the `amt-ca/Setup.bin` file to the root directory of an empty FAT32 USB key.

At each AMT device:

1. Plug-in the USB key, (re)boot the device, then let AMT be configured from the USB key.
    * If you end-up at the OS, you can force a reboot into the firmware with:
      * `sudo systemctl reboot --firmware-setup`
2. At the device OS, using the rpc tool, active AMT with:
    * `sudo ./rpc activate -u wss://mps.amt.test/activate -n -v -profile acm`
    * **NB** The `-n` flag will blindly trust the `mps.amt.test` certificate.
3. At the device OS, using the rpc tool, verify the AMT state and certificates:
    * `sudo ./rpc amtinfo -password 'HeyH0Password!' -cert`
4. To immediately trigger the AMT CIRA connection to OpenAMT MPS:
    1. Unplug the network cable.
    2. Wait a couple of minutes.
    3. Plug the network cable.

At the [OpenAMT UI](https://mps.amt.test):

1. Wait until the device appears as connected.
2. Try to access the device (e.g. start a `KVM` session).

# Notes

* The AMT domain can be anything, as long as you use it as the AMT device
  PKI DNS Suffix. it will not be used in any actual endpoint or request.
  the associated certificate and pfx will be only used once, at the AMT
  device activation time.
* But to keep things simpler to reason about, it should be the same domain
  (or a suffix) that is returned by the DHCP server (DHCP Option 15) that
  is in the AMT device LAN.
* If it's signed by a private CA, as we do here, that private CA certificate
  hash must be manually added to the AMT device, similar to what we do with
  the Setup.bin file that is copied to the USB key used to manually
  configure AMT at the AMT device.
* This is not related to the MPS domain or certificate. Therefore, it does not
  matter which CA signs the MPS certificate. In the case of OpenAMT, it is
  signed by an OpenAMT-created private CA (the MPSRoot CA). That CA is
  injected into the AMT device at its activation time (by the rpc tool).
* When the rpc tool is activating the AMT device, the AMT device will
  challenge the rpc tool to sign a message with this AMT domain private key.
* For more details, see:
    https://open-amt-cloud-toolkit.github.io/docs/2.17/Reference/Certificates/generateProvisioningCert/.

# Reference

* [rgl Intel AMT Notes](https://github.com/rgl/intel-amt-notes)
* [Intel AMT SDK](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/default.htm)
  * [Deprecated and Deleted Features](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/default.htm?turl=WordDocuments%2Fdeprecatedanddeletedfeatures.htm)
  * [Setup and Configuration of Intel AMT](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/default.htm?turl=WordDocuments%2Fsetupandconfigurationofintelamt.htm)
    * [Setup and Configuration Components](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/WordDocuments/setupandconfigurationcomponents1.htm)
    * [Remote Configuration](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/WordDocuments/remoteconfiguration.htm)
      * [Setup and Configuration Using PKI (Remote Configuration)](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/WordDocuments/setupandconfigurationusingpkiremoteconfiguration.htm)
        * [Prerequisites for Remote Configuration](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/WordDocuments/prerequisitesforremoteconfiguration.htm)
  * [Intel AMT Features](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/default.htm?turl=WordDocuments%2Fintelamtfeatures.htm)
    * [Enabling Client-Initiated Remote Access Fast Call for Help](https://software.intel.com/sites/manageability/AMT_Implementation_and_Reference_Guide/default.htm?turl=WordDocuments%2Fenablingclientinitiatedremoteaccessfastcallforhelp.htm)
* [Open Active Management Technology Cloud Toolkit](https://open-amt-cloud-toolkit.github.io/docs/2.17/)
  * [Custom Provisioning Certificate](https://open-amt-cloud-toolkit.github.io/docs/2.17/Reference/Certificates/generateProvisioningCert/)
