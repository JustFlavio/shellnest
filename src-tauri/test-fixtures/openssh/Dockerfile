# OpenSSH for the tests marked `#[ignore = "needs the openssh container"]` (see
# src-tauri/src/test_support/openssh.rs). Test-only credentials: never use this image for anything else.
#   port 22:   PAM two-factor, password and keyboard-interactive offered (the password, then a code)
#   port 2200: AuthenticationMethods publickey,keyboard-interactive (a key, then PAM)
#   port 2201: a plain password login without PAM, for the shell and SFTP
FROM ubuntu:24.04
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server libpam-google-authenticator oathtool \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /run/sshd \
 && useradd -m -s /bin/bash test \
 && echo 'test:test-only-password' | chpasswd \
 && printf 'JBSWY3DPEHPK3PXP\n" TOTP_AUTH\n' > /home/test/.google_authenticator \
 && chown test:test /home/test/.google_authenticator \
 && chmod 400 /home/test/.google_authenticator \
 && echo 'auth required pam_google_authenticator.so' >> /etc/pam.d/sshd \
 && printf 'UsePAM yes\nKbdInteractiveAuthentication yes\nPasswordAuthentication yes\n' \
    > /etc/ssh/sshd_config.d/2fa.conf \
 # SFTP: a folder the user cannot open, and one it can read but not write.
 && mkdir -m 700 /home/test/locked \
 && mkdir -m 755 /home/test/readonly \
 && echo 'read me' > /home/test/readonly/note.txt
EXPOSE 22 2200 2201
CMD /usr/sbin/sshd -p 2200 -o AuthenticationMethods=publickey,keyboard-interactive \
 && /usr/sbin/sshd -p 2201 -o UsePAM=no -o KbdInteractiveAuthentication=no \
 && exec /usr/sbin/sshd -D -e
