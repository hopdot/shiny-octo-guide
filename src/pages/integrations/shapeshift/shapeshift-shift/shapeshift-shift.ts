import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NavController } from 'ionic-angular';
import * as _ from 'lodash';
import { Logger } from '../../../../providers/logger/logger';

// Pages
import { AmountPage } from './../../../send/amount/amount';

// Providers
import { ActionSheetProvider } from '../../../../providers/action-sheet/action-sheet';
import { ExternalLinkProvider } from '../../../../providers/external-link/external-link';
import { PopupProvider } from '../../../../providers/popup/popup';
import { ProfileProvider } from '../../../../providers/profile/profile';
import { ShapeshiftProvider } from '../../../../providers/shapeshift/shapeshift';

@Component({
  selector: 'page-shapeshift-shift',
  templateUrl: 'shapeshift-shift.html'
})
export class ShapeshiftShiftPage {
  private walletsBtc;
  private walletsBch;

  public toWallets;
  public fromWallets;
  public fromWallet;
  public toWallet;
  public rate: number;
  public limit;
  public network: string;
  public fromWalletSelectorTitle: string;
  public toWalletSelectorTitle: string;
  public termsAccepted: boolean;

  constructor(
    private actionSheetProvider: ActionSheetProvider,
    private externalLinkProvider: ExternalLinkProvider,
    private logger: Logger,
    private navCtrl: NavController,
    private popupProvider: PopupProvider,
    private profileProvider: ProfileProvider,
    private shapeshiftProvider: ShapeshiftProvider,
    private translate: TranslateService
  ) {
    this.walletsBtc = [];
    this.walletsBch = [];
    this.toWallets = [];
    this.fromWallets = [];
    this.fromWalletSelectorTitle = 'From';
    this.toWalletSelectorTitle = 'To';
    this.termsAccepted = false;
    this.network = this.shapeshiftProvider.getNetwork();

    this.walletsBtc = this.profileProvider.getWallets({
      onlyComplete: true,
      network: this.network,
      coin: 'btc'
    });

    this.walletsBch = this.profileProvider.getWallets({
      onlyComplete: true,
      network: this.network,
      coin: 'bch'
    });

    if (_.isEmpty(this.walletsBtc) || _.isEmpty(this.walletsBch)) {
      this.showErrorAndBack(
        null,
        this.translate.instant('No wallets available to use ShapeShift')
      );
      return;
    }

    this.fromWallets = _.filter(this.walletsBtc.concat(this.walletsBch), w => {
      // Available cached funds
      if (!w.cachedBalance) return null;
      let hasCachedFunds = w.cachedBalance.match(/0\.00 /gi) ? false : true;
      return hasCachedFunds;
    });

    if (_.isEmpty(this.fromWallets)) {
      this.showErrorAndBack(
        null,
        this.translate.instant('No wallets with funds')
      );
      return;
    }

    this.onFromWalletSelect(this.fromWallets[0]);
  }

  ionViewDidLoad() {
    this.logger.info('Loaded: ShapeshiftShiftPage');
  }

  ionViewDidEnter() {
    this.termsAccepted = false;
  }

  public openTerms() {
    let url =
      'https://info.shapeshift.io/sites/default/files/ShapeShift_Terms_Conditions%20v1.1.pdf';
    this.externalLinkProvider.open(url);
  }

  private showErrorAndBack(title: string, msg): void {
    title = title ? title : this.translate.instant('Error');
    this.logger.error(msg);
    msg = msg && msg.errors ? msg.errors[0].message : msg;
    this.popupProvider.ionicAlert(title, msg).then(() => {
      this.navCtrl.pop();
    });
  }

  private showToWallets(): void {
    this.toWallets =
      this.fromWallet.coin == 'btc' ? this.walletsBch : this.walletsBtc;

    this.toWallets = this.toWallets.filter(w => !w.needsBackup);
    this.onToWalletSelect(this.toWallets[0]);

    let msg = this.translate.instant(
      'ShapeShift is not available at this moment. Please, try again later.'
    );
    let pair = this.fromWallet.coin + '_' + this.toWallet.coin;
    this.shapeshiftProvider.getRate(pair, (error, rate: number) => {
      if (error) return this.showErrorAndBack(null, msg);
      this.rate = rate;

      this.shapeshiftProvider.getMarketInfo(pair, (error, limit) => {
        if (error) return this.showErrorAndBack(null, msg);
        this.limit = limit;

        if (this.limit['rate'] == 0 || this.rate['rate'] == 0)
          return this.showErrorAndBack(null, msg);
      });
    });
  }

  public onFromWalletSelect(wallet): void {
    this.fromWallet = wallet;
    this.showToWallets();
  }

  public onToWalletSelect(wallet): void {
    this.toWallet = wallet;
  }

  public setAmount(): void {
    if (!this.termsAccepted) {
      return;
    }

    if (this.toWallet.needsBackup) {
      let title = this.translate.instant('Needs backup');
      let msg = this.translate.instant(
        'The destination wallet is not backed up. Please, complete the backup process before continue.'
      );
      this.popupProvider.ionicAlert(title, msg);
      return;
    }

    this.navCtrl.push(AmountPage, {
      nextPage: 'ShapeshiftConfirmPage',
      fixedUnit: true,
      coin: this.fromWallet.coin,
      id: this.fromWallet.id,
      toWalletId: this.toWallet.id,
      shiftMax: this.limit.limit + ' ' + this.fromWallet.coin.toUpperCase(),
      shiftMin: this.limit.minimum + ' ' + this.fromWallet.coin.toUpperCase()
    });
  }

  public showWallets(selector: string): void {
    let walletsForActionSheet = [];
    let selectedWalletId: string;
    let title: string =
      selector == 'from'
        ? this.fromWalletSelectorTitle
        : this.toWalletSelectorTitle;
    if (selector == 'from') {
      walletsForActionSheet = this.fromWallets;
      selectedWalletId = this.fromWallet.id;
    } else if (selector == 'to') {
      walletsForActionSheet = this.toWallets;
      selectedWalletId = this.toWallet.id;
    }
    const params = {
      wallets: walletsForActionSheet,
      selectedWalletId,
      title
    };
    const walletSelector = this.actionSheetProvider.createWalletSelector(
      params
    );
    walletSelector.present();
    walletSelector.onDidDismiss(wallet => {
      if (!_.isEmpty(wallet)) this.onWalletSelect(wallet, selector);
    });
  }

  public onWalletSelect(wallet, selector: string): void {
    if (selector == 'from') {
      this.onFromWalletSelect(wallet);
    } else if (selector == 'to') {
      this.onToWalletSelect(wallet);
    }
  }
}
