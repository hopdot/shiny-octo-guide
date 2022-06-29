import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { Logger } from '../../../../../../providers/logger/logger';

// providers
import { TranslateService } from '@ngx-translate/core';
import { ActionSheetProvider } from '../../../../../../providers/action-sheet/action-sheet';
import { BwcErrorProvider } from '../../../../../../providers/bwc-error/bwc-error';
import { ProfileProvider } from '../../../../../../providers/profile/profile';
import { WalletProvider } from '../../../../../../providers/wallet/wallet';

@Component({
  selector: 'page-wallet-extended-private-key',
  templateUrl: 'wallet-extended-private-key.html'
})
export class WalletExtendedPrivateKeyPage {
  public wallet;
  public credentialsEncrypted: boolean;
  public xPrivKey: string;

  constructor(
    private profileProvider: ProfileProvider,
    private walletProvider: WalletProvider,
    private logger: Logger,
    private navParams: NavParams,
    private navCtrl: NavController,
    private actionSheetProvider: ActionSheetProvider,
    private translate: TranslateService,
    private bwcErrorProvider: BwcErrorProvider
  ) {}

  ionViewDidLoad() {
    this.logger.info('Loaded: WalletExtendedPrivateKeyPage');
  }

  ionViewWillEnter() {
    this.wallet = this.profileProvider.getWallet(this.navParams.data.walletId);
    this.credentialsEncrypted = this.wallet.isPrivKeyEncrypted();
  }

  ionViewDidEnter() {
    this.walletProvider
      .getKeys(this.wallet)
      .then(k => {
        this.xPrivKey = k.xPrivKey;
        this.credentialsEncrypted = false;
      })
      .catch(err => {
        if (
          err &&
          err.message != 'FINGERPRINT_CANCELLED' &&
          err.message != 'PASSWORD_CANCELLED'
        ) {
          let title = this.translate.instant('Could not decrypt wallet');
          this.showErrorInfoSheet(this.bwcErrorProvider.msg(err), title);
        }
        this.navCtrl.pop();
      });
  }

  private showErrorInfoSheet(
    err: Error | string,
    infoSheetTitle: string
  ): void {
    if (!err) return;
    this.logger.error('Could not get keys:', err);
    const errorInfoSheet = this.actionSheetProvider.createInfoSheet(
      'default-error',
      { msg: err, title: infoSheetTitle }
    );
    errorInfoSheet.present();
  }
}
