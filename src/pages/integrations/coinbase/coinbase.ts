import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, NavController, NavParams } from 'ionic-angular';
import { Logger } from '../../../providers/logger/logger';

// providers
import { CoinbaseProvider } from '../../../providers/coinbase/coinbase';
import { ExternalLinkProvider } from '../../../providers/external-link/external-link';
import { OnGoingProcessProvider } from '../../../providers/on-going-process/on-going-process';
import { PlatformProvider } from '../../../providers/platform/platform';
import { PopupProvider } from '../../../providers/popup/popup';

// pages
import { AmountPage } from '../../send/amount/amount';
import { CoinbaseTxDetailsPage } from './coinbase-tx-details/coinbase-tx-details';

import * as _ from 'lodash';

@Component({
  selector: 'page-coinbase',
  templateUrl: 'coinbase.html'
})
export class CoinbasePage {
  public tx;
  public currency: string;
  public accessToken: string;
  public accountId: string;
  public loading: boolean;
  public buyPrice: string;
  public sellPrice: string;
  public pendingTransactions: object = { data: {} };
  public code: string;
  public showOauthForm: boolean;
  public oauthCodeForm: FormGroup;

  private isElectron: boolean;
  private isCordova: boolean;

  constructor(
    private coinbaseProvider: CoinbaseProvider,
    private logger: Logger,
    private popupProvider: PopupProvider,
    private navCtrl: NavController,
    private externalLinkProvider: ExternalLinkProvider,
    private platformProvider: PlatformProvider,
    private onGoingProcessProvider: OnGoingProcessProvider,
    private modalCtrl: ModalController,
    private navParams: NavParams,
    private formBuilder: FormBuilder
  ) {
    this.oauthCodeForm = this.formBuilder.group({
      code: [
        '',
        Validators.compose([Validators.minLength(1), Validators.required])
      ]
    });
    this.isElectron = this.platformProvider.isElectron;
    this.isCordova = this.platformProvider.isCordova;
    this.showOauthForm = false;
  }

  ionViewWillEnter() {
    if (this.navParams.data.code) {
      this.coinbaseProvider.getStoredToken((at: string) => {
        if (!at) this.submitOauthCode(this.navParams.data.code);
      });
    } else {
      this.init();
    }
  }

  private init(): void {
    this.currency = this.coinbaseProvider.getAvailableCurrency();
    this.loading = true;
    this.coinbaseProvider.getStoredToken((at: string) => {
      this.accessToken = at;

      // Update Access Token if necessary
      this.coinbaseProvider.init((err, data) => {
        if (err || _.isEmpty(data)) {
          this.loading = false;
          if (err) {
            this.logger.error(err);
            let errorId = err.errors ? err.errors[0].id : null;
            err = err.errors
              ? err.errors[0].message
              : err.error_description
              ? err.error_description
              : err.error || err || 'Unknown error';
            this.popupProvider
              .ionicAlert('Error connecting to Coinbase', err)
              .then(() => {
                if (errorId == 'revoked_token') {
                  this.coinbaseProvider.logout();
                }
                this.navCtrl.pop();
              });
          }
          return;
        }

        // Show rates
        this.coinbaseProvider.buyPrice(
          data.accessToken,
          this.currency,
          (_, b) => {
            this.buyPrice = b.data || null;
            this.coinbaseProvider.sellPrice(
              data.accessToken,
              this.currency,
              (_, s) => {
                this.sellPrice = s.data || null;
                this.loading = false;
              }
            );
          }
        );

        // Updating accessToken and accountId
        this.accessToken = data.accessToken;
        this.accountId = data.accountId;
        this.updateTransactions();
      });
    });
  }

  public updateTransactions(): void {
    this.logger.info('Getting transactions...');
    this.coinbaseProvider.getPendingTransactions(this.pendingTransactions);
  }

  public openAuthenticateWindow(): void {
    const oauthUrl = this.getAuthenticateUrl();
    if (!this.isElectron) {
      this.externalLinkProvider.open(oauthUrl);
    } else {
      const { remote } = (window as any).require('electron');
      const BrowserWindow = remote.BrowserWindow;
      const win = new BrowserWindow({
        alwaysOnTop: true,
        center: true,
        webPreferences: { nodeIntegration: false }
      });
      win.once('ready-to-show', () => {
        win.show();
        win.focus();
      });
      win.loadURL(oauthUrl);
      win.webContents.on('did-finish-load', () => {
        const title = win.webContents.getTitle();
        if (title.indexOf('Coinbase') == -1) {
          this.code = title;
          this.submitOauthCode(this.code);
          win.close();
        }
      });
    }
  }

  public submitOauthCode(code: string): void {
    this.onGoingProcessProvider.set('connectingCoinbase');
    this.coinbaseProvider.getToken(code, (err: string, accessToken: string) => {
      this.onGoingProcessProvider.clear();
      if (err) {
        this.popupProvider.ionicAlert('Error connecting to Coinbase', err);
        return;
      }
      if (!this.isElectron) {
        let previousView = this.navCtrl.getPrevious();
        this.navCtrl.removeView(previousView);
      }
      this.accessToken = accessToken;
      this.init();
    });
  }

  public getAuthenticateUrl(): string {
    this.showOauthForm = this.isCordova || this.isElectron ? false : true;
    return this.coinbaseProvider.getOauthCodeUrl();
  }

  public openSignupWindow(): void {
    let url = this.coinbaseProvider.getSignupUrl();
    let optIn = true;
    let title = 'Sign Up for Coinbase';
    let message =
      'This will open Coinbase.com, where you can create an account.';
    let okText = 'Go to Coinbase';
    let cancelText = 'Back';
    this.externalLinkProvider.open(
      url,
      optIn,
      title,
      message,
      okText,
      cancelText
    );
  }

  public openSupportWindow(): void {
    let url = this.coinbaseProvider.getSupportUrl();
    let optIn = true;
    let title = 'Coinbase Support';
    let message =
      'You can email support@coinbase.com for direct support, or you can view their help center.';
    let okText = 'Open Help Center';
    let cancelText = 'Go Back';
    this.externalLinkProvider.open(
      url,
      optIn,
      title,
      message,
      okText,
      cancelText
    );
  }

  public toggleOauthForm(): void {
    this.showOauthForm = !this.showOauthForm;
  }

  public openTxModal(tx) {
    this.tx = tx;

    let modal = this.modalCtrl.create(CoinbaseTxDetailsPage, { tx: this.tx });
    modal.present();
    modal.onDidDismiss(data => {
      if (data.updateRequired) this.updateTransactions();
    });
  }

  public goToBuyCoinbasePage(): void {
    this.navCtrl.push(AmountPage, {
      nextPage: 'BuyCoinbasePage',
      currency: this.currency,
      coin: 'btc',
      fixedUnit: true
    });
  }

  public goToSellCoinbasePage(): void {
    this.navCtrl.push(AmountPage, {
      nextPage: 'SellCoinbasePage',
      currency: this.currency,
      coin: 'btc',
      fixedUnit: true
    });
  }
}
