# OpenSSH with PAM two-factor (password, then a Google Authenticator code) for the tests in
# src-tauri/src/terminal/pam_tests.rs. Test-only credentials: never use this image for anything else.
#   port 22:   password and keyboard-interactive offered, PAM asks the password then the code
#   port 2200: AuthenticationMethods publickey,keyboard-interactive (a key, then PAM)
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
    > /etc/ssh/sshd_config.d/2fa.conf
EXPOSE 22 2200
CMD /usr/sbin/sshd -p 2200 -o AuthenticationMethods=publickey,keyboard-interactive \
 && exec /usr/sbin/sshd -D -e
